import { NotFoundError, Sandbox, SandboxNotFoundError } from "e2b";
import type { FileData } from "@/types/workspace";

/**
 * Sanitizes a file path intended for container writing:
 * - Prevents directory traversal (../)
 * - Blocks null bytes and shell control characters
 * - Normalizes to relative path
 */
export function sanitizeSandboxPath(rawPath: string): string | null {
    if (!rawPath || typeof rawPath !== "string") return null;
    const clean = rawPath.trim().replace(/^\/+/, "");
    if (clean.includes("\0") || clean.includes("..") || clean.includes("\\")) {
        return null;
    }
    if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(clean)) {
        return null;
    }
    return clean;
}

export const E2B_SANDBOX_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes default idle timeout

export function getE2bApiKey(): string {
    const candidateKeys = [
        process.env.E2B_SANDBOX_API_KEY,
        process.env.E2B_API_KEY,
    ].filter((k): k is string => !!k && k.trim().length > 0);

    // E2B API keys start with "e2b_"
    const validKey = candidateKeys.find((k) => k.startsWith("e2b_")) || candidateKeys[0] || "";
    if (!validKey) {
        throw new Error("Missing valid E2B_SANDBOX_API_KEY (must start with 'e2b_')");
    }
    return validKey;
}

/**
 * Proactively kills oldest running sandboxes to stay comfortably under concurrent limits
 */
export async function pruneStaleSandboxes(keepCount = 10): Promise<number> {
    try {
        const apiKey = getE2bApiKey();
        const paginator = Sandbox.list({ apiKey });
        const items = await paginator.nextItems();
        if (!items || items.length <= keepCount) {
            return 0;
        }

        // Sort by startedAt ascending (oldest first)
        const sorted = [...items].sort((a, b) => {
            const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            return timeA - timeB;
        });

        const toPruneCount = items.length - keepCount;
        const toPrune = sorted.slice(0, toPruneCount);

        let pruned = 0;
        await Promise.all(
            toPrune.map(async (s) => {
                try {
                    await Sandbox.kill(s.sandboxId, { apiKey });
                    pruned++;
                } catch {
                    // Silently ignore already terminated sandboxes
                }
            })
        );

        return pruned;
    } catch (err) {
        console.warn("[E2B Pruner] Failed to prune sandboxes:", err);
        return 0;
    }
}

/**
 * Creates an isolated E2B cloud sandbox instance with public web traffic enabled.
 * Automatically self-heals by pruning stale sandboxes if concurrent limit (20) is approached.
 */
export async function createE2bSandbox(
    timeoutMs = E2B_SANDBOX_TIMEOUT_MS,
    ownerId?: string
): Promise<Sandbox> {
    const apiKey = getE2bApiKey();
    const createConfig = {
        apiKey,
        timeoutMs,
        envs: {
            HOST: "0.0.0.0",
            BACKEND_PORT: "3001",
            NODE_OPTIONS: "--max-old-space-size=384",
        },
        network: {
            allowPublicTraffic: true,
            maskRequestHost: "localhost:${PORT}",
        },
        lifecycle: {
            onTimeout: "pause" as const,
            autoResume: true,
        },
        metadata: {
            app: "zephyre",
            timestamp: new Date().toISOString(),
            ...(ownerId ? { ownerId } : {}),
        },
    };

    try {
        return await Sandbox.create(createConfig);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // If 20 concurrent limit or rate limit exceeded, proactively prune stale sandboxes and retry
        if (
            msg.includes("Rate limit exceeded") ||
            msg.includes("maximum number of concurrent") ||
            msg.includes("429")
        ) {
            console.warn(
                "[E2B] Concurrent sandbox limit (20) reached. Automatically pruning stale microVMs and retrying..."
            );
            await pruneStaleSandboxes(8);
            await new Promise((res) => setTimeout(res, 500));
            return await Sandbox.create(createConfig);
        }
        throw err;
    }
}

/**
 * Verifies that the requested E2B sandbox exists and belongs to the authenticated Clerk user.
 */
export async function verifySandboxOwnership(
    sandboxId: string,
    ownerId: string
): Promise<"authorized" | "forbidden" | "not_found"> {
    const apiKey = getE2bApiKey();
    try {
        const info = await Sandbox.getInfo(sandboxId, { apiKey });
        const metadataOwner = info?.metadata?.ownerId;
        if (!metadataOwner || metadataOwner !== ownerId) {
            return "forbidden";
        }
        return "authorized";
    } catch (err: unknown) {
        if (err instanceof SandboxNotFoundError || err instanceof NotFoundError) {
            return "not_found";
        }
        const errMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (errMsg.includes("not found") || errMsg.includes("404")) {
            return "not_found";
        }
        throw err;
    }
}

/**
 * Re-connects to an existing running sandbox by ID
 */
export async function connectE2bSandbox(sandboxId: string): Promise<Sandbox> {
    const apiKey = getE2bApiKey();
    return await Sandbox.connect(sandboxId, { apiKey });
}

/**
 * Gracefully shuts down a sandbox by ID
 */
export async function killE2bSandbox(sandboxId: string): Promise<boolean> {
    const apiKey = getE2bApiKey();
    try {
        return await Sandbox.kill(sandboxId, { apiKey });
    } catch {
        return false;
    }
}

/**
 * Detects whether the project stack is Python or standard Node/React
 */
export function detectStack(files: Record<string, { code: string }>): "python" | "react-node" {
    const paths = Object.keys(files);
    const hasPython = paths.some((p) => p.endsWith(".py") || p.includes("requirements.txt"));
    return hasPython ? "python" : "react-node";
}

export const STANDARD_VITE_CONFIG = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ['**/node_modules/**', '**/.git/**', '**/database.json', '**/database.sqlite*', '**/*.log'],
    },
    hmr: {
      clientPort: 443,
    },
  },
});
`.trim();

export const ZEPHYRE_ERROR_BRIDGE_SCRIPT = `
<script id="zephyre-error-bridge">
(function() {
  // Guard against SecurityError when third-party cookies / storage are blocked in iframe
  try {
    var _lsTest = '__zephyre_ls_test__';
    window.localStorage.setItem(_lsTest, '1');
    window.localStorage.removeItem(_lsTest);
  } catch (lsErr) {
    try {
      var _memStore = {};
      var _memStorage = {
        getItem: function(k) { return Object.prototype.hasOwnProperty.call(_memStore, k) ? _memStore[k] : null; },
        setItem: function(k, v) { _memStore[String(k)] = String(v); },
        removeItem: function(k) { delete _memStore[String(k)]; },
        clear: function() { _memStore = {}; },
        key: function(i) { return Object.keys(_memStore)[i] || null; },
        get length() { return Object.keys(_memStore).length; }
      };
      Object.defineProperty(window, 'localStorage', { value: _memStorage, configurable: true });
    } catch (e2) {}
  }

  var lastErrorKey = '';
  function sendError(data) {
    if (!data || !data.message) return;
    window.__zephyre_last_error = data.message;
    window.__zephyre_error_caught = true;
    var key = (data.file || '') + ':' + (data.line || '') + ':' + data.message;
    if (key === lastErrorKey) return;
    lastErrorKey = key;
    try {
      window.parent.postMessage({
        source: 'zephyre-preview-error',
        category: data.category || 'runtime',
        message: data.message,
        file: data.file || '',
        line: data.line,
        column: data.column,
        codeFrame: data.codeFrame || '',
        stack: data.stack || data.message
      }, '*');
    } catch(e) {}
  }

  function clearError() {
    window.__zephyre_last_error = '';
    window.__zephyre_error_caught = false;
    if (lastErrorKey) {
      lastErrorKey = '';
      try {
        window.parent.postMessage({ source: 'zephyre-preview-clear' }, '*');
      } catch(e) {}
    }
  }

  // Interactive Element Inspector for Click-to-Prompt Target Selection
  var isInspectorActive = false;
  var hoverOutline = null;
  var hoverBadge = null;

  function ensureInspectorOverlay() {
    if (!hoverOutline && document.body) {
      hoverOutline = document.createElement('div');
      hoverOutline.id = 'zephyre-inspector-overlay';
      hoverOutline.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px dashed #f97316;background:rgba(249,115,22,0.12);border-radius:4px;transition:all 40ms ease-out;display:none;';
      hoverBadge = document.createElement('div');
      hoverBadge.style.cssText = 'position:absolute;top:-22px;left:0;background:#f97316;color:#fff;font-size:10px;font-family:monospace;padding:1px 6px;border-radius:3px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.5);';
      hoverOutline.appendChild(hoverBadge);
      document.body.appendChild(hoverOutline);
    }
  }

  window.addEventListener('message', function(ev) {
    if (ev.data && ev.data.type === 'zephyre-toggle-inspector') {
      isInspectorActive = Boolean(ev.data.enabled);
      ensureInspectorOverlay();
      if (!isInspectorActive && hoverOutline) {
        hoverOutline.style.display = 'none';
      }
    }
  });

  window.addEventListener('mousemove', function(e) {
    if (!isInspectorActive) return;
    ensureInspectorOverlay();
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === hoverOutline || (hoverOutline && hoverOutline.contains(target)) || target === document.body || target === document.documentElement) {
      if (hoverOutline) hoverOutline.style.display = 'none';
      return;
    }
    var rect = target.getBoundingClientRect();
    if (hoverOutline && hoverBadge) {
      hoverOutline.style.display = 'block';
      hoverOutline.style.top = rect.top + 'px';
      hoverOutline.style.left = rect.left + 'px';
      hoverOutline.style.width = rect.width + 'px';
      hoverOutline.style.height = rect.height + 'px';

      var tagName = target.tagName.toLowerCase();
      var textSnippet = (target.textContent || '').trim().slice(0, 25);
      hoverBadge.textContent = '<' + tagName + '> ' + (textSnippet ? '"' + textSnippet + '"' : '');
    }
  }, true);

  window.addEventListener('click', function(e) {
    if (!isInspectorActive) return;
    e.preventDefault();
    e.stopPropagation();
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;

    var tagName = target.tagName.toLowerCase();
    var textSnippet = (target.textContent || '').trim().slice(0, 35);
    var classes = (target.className && typeof target.className === 'string') ? target.className.slice(0, 80) : '';

    var componentHint = '';
    var curr = target;
    while (curr && curr !== document.body) {
      if (curr.getAttribute('data-component')) {
        componentHint = curr.getAttribute('data-component');
        break;
      }
      curr = curr.parentElement;
    }

    try {
      window.parent.postMessage({
        source: 'zephyre-element-inspected',
        tagName: tagName,
        classes: classes,
        textSnippet: textSnippet,
        componentHint: componentHint
      }, '*');
    } catch(err) {}

    isInspectorActive = false;
    if (hoverOutline) hoverOutline.style.display = 'none';
  }, true);

  // 1. Intercept customElements.define to catch Vite's ErrorOverlay instantiation directly
  if (window.customElements && typeof window.customElements.define === 'function') {
    var origDefine = window.customElements.define.bind(window.customElements);
    window.customElements.define = function(name, constructor, options) {
      if (name === 'vite-error-overlay') {
        class ZephyreErrorOverlay extends constructor {
          constructor(err, links) {
            super(err, links);
            try {
              if (err) {
                var filePath = (err.loc && err.loc.file) || err.id || '';
                var cleanPath = filePath.replace(/^\\/+/, '').replace(/^home\\/user\\/app\\//, '');
                var fullText = [
                  err.plugin ? ('[plugin:' + err.plugin + ']') : '',
                  cleanPath ? (cleanPath + ':') : '',
                  err.message,
                  err.frame
                ].filter(Boolean).join('\\n');
                sendError({
                  category: 'compile',
                  message: (err.message || 'Compilation error').trim(),
                  file: cleanPath,
                  line: err.loc ? err.loc.line : undefined,
                  column: err.loc ? err.loc.column : undefined,
                  codeFrame: err.frame || '',
                  stack: fullText || err.stack || err.message
                });
              }
            } catch(e) {}
          }
          close() {
            super.close();
            clearError();
          }
        }
        return origDefine(name, ZephyreErrorOverlay, options);
      }
      return origDefine(name, constructor, options);
    };
  }

  // 2. Intercept WebSocket messages from Vite dev server to catch HMR errors instantaneously
  if (window.WebSocket) {
    var OrigWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      var ws = new OrigWebSocket(url, protocols);
      ws.addEventListener('message', function(ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data.type === 'error' && data.err) {
            var err = data.err;
            var filePath = (err.loc && err.loc.file) || err.id || '';
            var cleanPath = filePath.replace(/^\\/+/, '').replace(/^home\\/user\\/app\\//, '');
            var fullText = [
              err.plugin ? ('[plugin:' + err.plugin + ']') : '',
              cleanPath ? (cleanPath + ':') : '',
              err.message,
              err.frame
            ].filter(Boolean).join('\\n');
            sendError({
              category: 'compile',
              message: (err.message || 'Build error').trim(),
              file: cleanPath,
              line: err.loc ? err.loc.line : undefined,
              column: err.loc ? err.loc.column : undefined,
              codeFrame: err.frame || '',
              stack: fullText || err.stack || err.message
            });
          } else if (data.type === 'update' || data.type === 'connected') {
            setTimeout(function() {
              if (!document.querySelector('vite-error-overlay')) {
                clearError();
              }
            }, 150);
          }
        } catch(e) {}
      });
      return ws;
    };
    window.WebSocket.prototype = OrigWebSocket.prototype;
    window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
    window.WebSocket.OPEN = OrigWebSocket.OPEN;
    window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
    window.WebSocket.CLOSED = OrigWebSocket.CLOSED;
  }

  // 3. Global runtime and promise rejection catchers (capturing phase catches resource load failures)
  window.addEventListener('error', function(e) {
    var target = e.target;
    if (target && target !== window && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      var src = target.src || target.href || 'resource';
      var filename = src.split('/').pop() || src;
      sendError({
        category: 'runtime',
        message: 'Failed to load asset or script: ' + filename,
        file: filename,
        stack: 'Failed to load network asset: ' + src
      });
      return;
    }
    var msg = e.message || 'Script error';
    sendError({
      category: 'runtime',
      message: msg,
      file: (e.filename || '').replace(/^home\\/user\\/app\\//, ''),
      line: e.lineno,
      column: e.colno,
      stack: e.error ? (e.error.stack || e.error.message) : msg
    });
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason;
    var msg = reason ? (reason.stack || reason.message || String(reason)) : 'Unhandled Promise Rejection';
    sendError({
      category: 'runtime',
      message: msg,
      stack: msg
    });
  });

  // 3b. Intercept console.error for React 19 component render failures
  var origConsoleError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    origConsoleError.apply(console, args);
    var firstArg = args[0];
    if (typeof firstArg === 'string' && (firstArg.includes('The above error occurred') || firstArg.includes('Uncaught Error'))) {
      sendError({
        category: 'runtime',
        message: firstArg.slice(0, 300),
        stack: args.map(function(a) { return typeof a === 'object' ? (a && a.stack ? a.stack : JSON.stringify(a)) : String(a); }).join('\\n')
      });
    }
  };

  // Watchdog: Only surface a notice if React truly encountered a fatal error after a generous grace period (20s)
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (window.__zephyre_mounted) return;
      var root = document.getElementById('root');
      var loader = document.getElementById('zephyre-initial-loader');
      if (window.__zephyre_last_error && root && (!root.childNodes || root.childNodes.length === 0 || (root.childNodes.length === 1 && root.contains(loader)))) {
        sendError({
          category: 'runtime',
          message: window.__zephyre_last_error,
          stack: window.__zephyre_last_error
        });
        if (loader) loader.remove();
        root.innerHTML = '<div style=\"min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#f87171;font-family:sans-serif;padding:2rem;\"><div style=\"max-width:540px;background:#18181b;padding:1.5rem;border-radius:1rem;border:1px solid #ef444433;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);\"><h3 style=\"font-weight:700;margin-bottom:0.5rem;color:#fca5a5;font-size:1.1rem;\">Application Runtime Notice</h3><p style=\"font-size:0.875rem;color:#a1a1aa;word-break:break-word;font-family:monospace;background:#09090b;padding:0.75rem;border-radius:0.5rem;border:1px solid #27272a;\">' + window.__zephyre_last_error + '</p><div style=\"margin-top:1rem;display:flex;gap:0.75rem;\"><button onclick=\"location.reload()\" style=\"padding:0.5rem 1rem;background:#ef4444;color:white;border:none;border-radius:0.5rem;font-size:0.75rem;cursor:pointer;font-weight:600;\">Reload App</button></div></div></div>';
      }
    }, 20000);
  });

  // 4. Fallback DOM inspector for <vite-error-overlay> ShadowRoot
  function checkViteOverlay() {
    var overlay = document.querySelector('vite-error-overlay');
    if (overlay && overlay.shadowRoot) {
      var root = overlay.shadowRoot;
      var msgEl = root.querySelector('.message-body');
      var fileEl = root.querySelector('.file');
      var frameEl = root.querySelector('.frame');
      var stackEl = root.querySelector('.stack');
      var rawText = (root.textContent || '').trim();
      var msg = (msgEl && msgEl.textContent ? msgEl.textContent : '') || rawText.split('\\n')[0] || 'Build error';
      var frame = frameEl ? frameEl.textContent : '';
      var fileText = fileEl ? fileEl.textContent : '';
      var stack = stackEl ? stackEl.textContent : rawText;

      var fileMatch = fileText.match(/(?:[a-zA-Z0-9_\\-\\.\\/]+\\.(?:jsx?|tsx?|css|json|html|py))/i) ||
                      rawText.match(/(?:[a-zA-Z0-9_\\-\\.\\/]+\\.(?:jsx?|tsx?|css|json|html|py))/i);
      var lineMatch = fileText.match(/:(\\d+)(?::(\\d+))?/) || rawText.match(/\\((\\d+):(\\d+)\\)/);

      sendError({
        category: 'compile',
        message: msg.trim(),
        file: fileMatch ? fileMatch[0].replace(/^home\\/user\\/app\\//, '') : '',
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        column: lineMatch && lineMatch[2] ? parseInt(lineMatch[2], 10) : undefined,
        codeFrame: frame || rawText,
        stack: stack || rawText
      });
      return;
    }
    if (lastErrorKey && lastErrorKey.includes('compile') && !document.querySelector('vite-error-overlay')) {
      clearError();
    }
  }

  var observer = new MutationObserver(function() {
    setTimeout(checkViteOverlay, 30);
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  // Periodic fallback check
  setInterval(checkViteOverlay, 400);
})();
</script>
`.trim();

export const ZEPHYRE_INITIAL_LOADER = `
<div id="zephyre-initial-loader" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#09090b;color:#a1a1aa;font-family:system-ui,-apple-system,sans-serif;gap:12px;z-index:9999;">
  <div style="width:28px;height:28px;border:2.5px solid rgba(255,255,255,0.1);border-top-color:#f97316;border-radius:50%;animation:zephyre-spin 0.8s linear infinite;"></div>
  <div style="font-size:12px;font-weight:500;color:#d4d4d8;letter-spacing:0.02em;">Loading preview...</div>
  <style>@keyframes zephyre-spin{to{transform:rotate(360deg)}}</style>
</div>
`.trim();

export const ZEPHYRE_HMR_REPORTER_CODE = `
// Live mount verification and HMR compilation error reporter for Zephyre IDE
class ZephyreErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: (error && error.message) ? error.message : 'Application render error' };
  }
  componentDidCatch(error, info) {
    try {
      window.__zephyre_error_caught = true;
      window.__zephyre_last_error = this.state.message;
      var loader = document.getElementById('zephyre-initial-loader');
      if (loader) loader.remove();
      window.parent.postMessage({
        source: 'zephyre-preview-error',
        category: 'runtime',
        message: this.state.message,
        file: 'src/App.jsx',
        stack: [error && error.stack, info && info.componentStack].filter(Boolean).join('\\n')
      }, '*');
    } catch (e) {}
  }
  render() {
    if (this.state.hasError) {
      return React.createElement(
        'div',
        { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', color: '#fca5a5', fontFamily: 'system-ui, sans-serif', padding: '24px' } },
        React.createElement(
          'div',
          { style: { maxWidth: '520px', background: '#18181b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px', padding: '20px' } },
          React.createElement('h3', { style: { fontWeight: 700, fontSize: '16px', marginBottom: '8px' } }, 'Application Render Error'),
          React.createElement('p', { style: { fontSize: '13px', color: '#a1a1aa', fontFamily: 'monospace', wordBreak: 'break-word' } }, this.state.message)
        )
      );
    }
    return this.props.children;
  }
}

function zephyreVerifyRenderedRoot(rootElement) {
  if (typeof window === 'undefined' || !rootElement) return;
  setTimeout(() => {
    try {
      var initLoader = document.getElementById('zephyre-initial-loader');
      if (initLoader) initLoader.remove();
      if (window.__zephyre_error_caught) return;

      var hasDom = rootElement.children.length > 0 || (rootElement.textContent || '').trim().length > 0;
      if (!hasDom) {
        var emptyMsg = 'Root component <App /> rendered empty content (missing JSX return or empty output).';
        window.__zephyre_last_error = emptyMsg;
        window.parent.postMessage({
          source: 'zephyre-preview-error',
          category: 'runtime',
          message: emptyMsg,
          file: 'src/App.jsx',
          stack: emptyMsg
        }, '*');
        rootElement.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#f87171;font-family:system-ui,sans-serif;padding:24px;"><div style="max-width:520px;background:#18181b;border:1px solid rgba(239,68,68,0.3);border-radius:14px;padding:20px;"><h3 style="font-weight:700;color:#fca5a5;margin:0 0 8px;font-size:16px;">Empty Application Output</h3><p style="font-size:13px;color:#a1a1aa;margin:0 0 14px;">The root App component returned no UI elements. Use Fix now in the workspace to restore the layout.</p><button onclick="location.reload()" style="padding:8px 14px;background:#f97316;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Reload Preview</button></div></div>';
        return;
      }

      window.__zephyre_mounted = true;
      window.parent.postMessage({ source: 'zephyre-preview-mounted' }, '*');
    } catch(e) {}
  }, 450);
}

if (import.meta.hot) {
  import.meta.hot.on('vite:error', (payload) => {
    try {
      const err = payload.err || {};
      const fullText = [
        err.plugin ? \`[plugin:\${err.plugin}]\` : '',
        err.id ? \`\${err.id}:\` : '',
        err.message,
        err.frame
      ].filter(Boolean).join('\\n');
      window.parent.postMessage({
        source: 'zephyre-preview-error',
        category: 'compile',
        message: err.message || 'Build error',
        file: err.id ? err.id.replace(/^.*\\/src\\//, 'src/').replace(/^.*\\/app\\//, '') : '',
        line: err.loc?.line,
        column: err.loc?.column,
        codeFrame: err.frame || '',
        stack: fullText
      }, '*');
    } catch (e) {}
  });

  import.meta.hot.on('vite:beforeUpdate', () => {
    try {
      window.parent.postMessage({ source: 'zephyre-preview-clear' }, '*');
    } catch (e) {}
  });
}
`.trim();

function buildDatabaseSyncClassBody(): string {
    return `
class DatabaseSync {
  constructor(filename = './database.sqlite') {
    this.jsonFile = filename.endsWith('.json') ? filename : filename.replace(/\\.[^.]+$/, '') + '.json';
    this.store = {};
    try {
      if (fs.existsSync(this.jsonFile)) {
        this.store = JSON.parse(fs.readFileSync(this.jsonFile, 'utf-8'));
      }
    } catch {
      this.store = {};
    }
  }

  _persist() {
    try {
      fs.writeFileSync(this.jsonFile, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DatabaseSync Shim] Persist error:', e);
    }
  }

  pragma() {}
  close() {}

  _coerceLiteral(raw) {
    const t = raw.trim();
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
      return t.slice(1, -1);
    }
    if (/^null$/i.test(t)) return null;
    if (/^true$/i.test(t)) return true;
    if (/^false$/i.test(t)) return false;
    if (/^-?\\d+(?:\\.\\d+)?$/.test(t)) return Number(t);
    return t;
  }

  _valuesEqual(rowVal, targetVal) {
    if (rowVal === undefined || rowVal === null) {
      return targetVal === undefined || targetVal === null;
    }
    if (targetVal === undefined || targetVal === null) return false;
    if (typeof rowVal === 'boolean') {
      if (typeof targetVal === 'boolean') return rowVal === targetVal;
      if (targetVal === 1 || targetVal === '1' || targetVal === 'true') return rowVal === true;
      if (targetVal === 0 || targetVal === '0' || targetVal === 'false') return rowVal === false;
    }
    if (typeof targetVal === 'boolean') {
      if (rowVal === 1 || rowVal === '1') return targetVal === true;
      if (rowVal === 0 || rowVal === '0') return targetVal === false;
    }
    if (
      (typeof rowVal === 'number' || (typeof rowVal === 'string' && /^-?\\d+(?:\\.\\d+)?$/.test(rowVal.trim()))) &&
      (typeof targetVal === 'number' || (typeof targetVal === 'string' && /^-?\\d+(?:\\.\\d+)?$/.test(targetVal.trim())))
    ) {
      return Number(rowVal) === Number(targetVal);
    }
    return String(rowVal) === String(targetVal);
  }

  _filterRows(rows, sql, args, initialArgOffset = 0) {
    const whereMatch = sql.match(/\\bWHERE\\b\\s+([\\s\\S]+?)(?:\\bORDER\\s+BY\\b|\\bGROUP\\s+BY\\b|\\bLIMIT\\b|\\bOFFSET\\b|;|$)/i);
    if (!whereMatch) {
      return { filtered: [...rows], nextArgIndex: initialArgOffset };
    }
    let argIdx = initialArgOffset;
    const clauses = whereMatch[1].trim().split(/\\s+AND\\s+/i);
    const predicates = clauses.map((clause) => {
      const likeParam = clause.match(/^(?:[a-zA-Z0-9_]+\\.)?([a-zA-Z0-9_]+)\\s+LIKE\\s+\\?$/i);
      if (likeParam) {
        const col = likeParam[1];
        const pattern = String(args[argIdx++] ?? '').replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&').replace(/%/g, '.*').replace(/_/g, '.');
        const re = new RegExp('^' + pattern + '$', 'i');
        return (r) => re.test(String(r[col] ?? ''));
      }
      const eqParam = clause.match(/^(?:[a-zA-Z0-9_]+\\.)?([a-zA-Z0-9_]+)\\s*=\\s*\\?$/i);
      if (eqParam) {
        const col = eqParam[1];
        const expected = args[argIdx++];
        return (r) => this._valuesEqual(r[col], expected);
      }
      const eqLiteral = clause.match(/^(?:[a-zA-Z0-9_]+\\.)?([a-zA-Z0-9_]+)\\s*=\\s*(.+)$/i);
      if (eqLiteral) {
        const col = eqLiteral[1];
        const expected = this._coerceLiteral(eqLiteral[2]);
        return (r) => this._valuesEqual(r[col], expected);
      }
      return () => true;
    });
    const filtered = rows.filter((row) => predicates.every((fn) => fn(row)));
    return { filtered, nextArgIndex: argIdx };
  }

  _applyOrderAndLimit(rows, sql, args, argOffset) {
    let result = [...rows];
    let idx = argOffset;
    const orderMatch = sql.match(/\\bORDER\\s+BY\\s+(?:[a-zA-Z0-9_]+\\.)?([a-zA-Z0-9_]+)(?:\\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const desc = (orderMatch[2] || 'ASC').toUpperCase() === 'DESC';
      result.sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return desc ? 1 : -1;
        if (bv == null) return desc ? -1 : 1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return desc ? bv - av : av - bv;
        }
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return desc ? -cmp : cmp;
      });
    }
    const limitMatch = sql.match(/\\bLIMIT\\s+(\\?|\\d+)(?:\\s+OFFSET\\s+(\\?|\\d+))?/i);
    if (limitMatch) {
      const rawLimit = limitMatch[1] === '?' ? Number(args[idx++]) : Number(limitMatch[1]);
      const rawOffset = limitMatch[2] ? (limitMatch[2] === '?' ? Number(args[idx++]) : Number(limitMatch[2])) : 0;
      const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
      const limit = Number.isFinite(rawLimit) && rawLimit >= 0 ? rawLimit : result.length;
      result = result.slice(offset, offset + limit);
    }
    return result;
  }

  exec(sql) {
    const matches = [...sql.matchAll(/CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-zA-Z0-9_]+)/gi)];
    let changed = false;
    for (const match of matches) {
      if (match[1]) {
        const table = match[1].toLowerCase();
        if (!this.store[table]) {
          this.store[table] = [];
          changed = true;
        }
      }
    }
    if (changed) this._persist();
  }

  prepare(sql) {
    const trimmed = sql.trim();
    const self = this;

    if (/^SELECT/i.test(trimmed)) {
      const match = trimmed.match(/FROM\\s+([a-zA-Z0-9_]+)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      const countMatch = trimmed.match(/^SELECT\\s+COUNT\\s*\\([^)]*\\)(?:\\s+AS\\s+([a-zA-Z0-9_]+))?/i);
      return {
        all(...args) {
          const rows = self.store[table] || [];
          const { filtered, nextArgIndex } = self._filterRows(rows, trimmed, args, 0);
          if (countMatch) {
            const alias = countMatch[1] || 'count';
            return [{ [alias]: filtered.length }];
          }
          return self._applyOrderAndLimit(filtered, trimmed, args, nextArgIndex);
        },
        get(...args) {
          const rows = self.store[table] || [];
          const { filtered, nextArgIndex } = self._filterRows(rows, trimmed, args, 0);
          if (countMatch) {
            const alias = countMatch[1] || 'count';
            return { [alias]: filtered.length };
          }
          const ordered = self._applyOrderAndLimit(filtered, trimmed, args, nextArgIndex);
          return ordered[0] || null;
        },
        run() { return { changes: 0 }; }
      };
    }

    if (/^INSERT/i.test(trimmed)) {
      const match = trimmed.match(/INTO\\s+([a-zA-Z0-9_]+)\\s*\\(([^)]+)\\)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      const cols = match ? match[2].split(',').map(c => c.trim()) : [];
      const valuesMatch = trimmed.match(/VALUES\\s*\\(([^)]+)\\)/i);
      const valueExprs = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
      return {
        run(...args) {
          if (!self.store[table]) self.store[table] = [];
          const rows = self.store[table];
          const nextId = rows.length > 0 ? Math.max(...rows.map(r => Number(r.id) || 0)) + 1 : 1;
          const newRow = { id: nextId };
          let argIdx = 0;
          cols.forEach((col, idx) => {
            const expr = valueExprs[idx];
            if (!expr || expr === '?') {
              newRow[col] = args[argIdx] !== undefined ? args[argIdx] : null;
              argIdx++;
            } else {
              newRow[col] = self._coerceLiteral(expr);
            }
          });
          newRow.created_at = newRow.created_at || new Date().toISOString();
          rows.push(newRow);
          self._persist();
          return { lastInsertRowid: nextId, changes: 1 };
        },
        all() { return []; },
        get() { return null; }
      };
    }

    if (/^UPDATE/i.test(trimmed)) {
      const match = trimmed.match(/UPDATE\\s+([a-zA-Z0-9_]+)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      const setMatch = trimmed.match(/\\bSET\\s+([\\s\\S]+?)(?:\\s+\\bWHERE\\b|$)/i);
      const assignments = setMatch ? setMatch[1].split(',').map(s => s.trim()) : [];
      return {
        run(...args) {
          const rows = self.store[table] || [];
          let argIdx = 0;
          const updates = [];
          for (const part of assignments) {
            const m = part.match(/^([a-zA-Z0-9_]+)\\s*=\\s*(.+)$/);
            if (!m) continue;
            const col = m[1];
            const rhs = m[2].trim();
            if (rhs === '?') {
              const val = args[argIdx++];
              updates.push((row) => { row[col] = val; });
            } else if (/^NOT\\s+/i.test(rhs)) {
              updates.push((row) => { row[col] = row[col] ? 0 : 1; });
            } else {
              const literalVal = self._coerceLiteral(rhs);
              updates.push((row) => { row[col] = literalVal; });
            }
          }
          const { filtered } = self._filterRows(rows, trimmed, args, argIdx);
          if (filtered.length > 0) {
            for (const row of filtered) {
              for (const applyFn of updates) applyFn(row);
            }
            self._persist();
          }
          return { changes: filtered.length };
        },
        all() { return []; },
        get() { return null; }
      };
    }

    if (/^DELETE/i.test(trimmed)) {
      const match = trimmed.match(/FROM\\s+([a-zA-Z0-9_]+)/i);
      const table = match ? match[1].toLowerCase() : 'items';
      return {
        run(...args) {
          if (!self.store[table]) return { changes: 0 };
          const rows = self.store[table];
          if (!/\\bWHERE\\b/i.test(trimmed)) {
            const count = rows.length;
            self.store[table] = [];
            if (count > 0) self._persist();
            return { changes: count };
          }
          const { filtered } = self._filterRows(rows, trimmed, args, 0);
          if (filtered.length === 0) return { changes: 0 };
          const toDelete = new Set(filtered);
          self.store[table] = rows.filter((r) => !toDelete.has(r));
          self._persist();
          return { changes: toDelete.size };
        },
        all() { return []; },
        get() { return null; }
      };
    }

    return {
      run() { return { changes: 0 }; },
      all() { return []; },
      get() { return null; }
    };
  }
}`.trim();
}

export const SQLITE_SHIM_CODE = `
import fs from 'node:fs';

export ${buildDatabaseSyncClassBody()}
`.trim();

export const SQLITE_SHIM_CJS_CODE = `
const fs = require('node:fs');

${buildDatabaseSyncClassBody()}

module.exports = { DatabaseSync };
`.trim();

/**
 * Rewrites hardcoded localhost:3001 backend URLs in client source files to relative /api
 * paths so browser previews route cleanly through Vite's /api proxy.
 */
export function normalizeClientApiUrls(code: string): string {
    return code
        .replace(/https?:\/\/(?:localhost|127\.0\.0\.1):3001(?=\/api\b)/g, "")
        .replace(/(['"`])https?:\/\/(?:localhost|127\.0\.0\.1):3001\1/g, "$1$1");
}

/**
 * Detects whether a backend script uses CommonJS (require/module.exports/__dirname)
 * rather than ES module syntax.
 */
export function isCommonJsServerCode(code: string): boolean {
    const hasEsm = /^\s*import\s+[\s\S]*?\s+from\s+['"]|^\s*export\s+/m.test(code);
    const hasCjs = /\brequire\s*\(|\bmodule\.exports\b|\b__dirname\b|\b__filename\b/.test(code);
    return hasCjs && !hasEsm;
}

/**
 * Normalizes backend server code for port 3001, Node 20 sqlite shimming, and CJS vs ESM
 * execution compatibility under a `"type": "module"` Vite workspace.
 */
export function prepareBackendServerFiles(rawServerCode: string): {
    isCjs: boolean;
    files: Record<string, string>;
} {
    const portNormalized = rawServerCode
        .replace(/const\s+PORT\s*=\s*process\.env\.PORT\s*\|\|\s*\d+/g, "const PORT = process.env.BACKEND_PORT || 3001")
        .replace(/const\s+PORT\s*=\s*3000\b/g, "const PORT = 3001")
        .replace(/app\.listen\(\s*3000\s*,/g, "app.listen(3001,");

    const isCjs = isCommonJsServerCode(portNormalized);
    const files: Record<string, string> = {};

    if (isCjs) {
        files["sqlite-shim.cjs"] = SQLITE_SHIM_CJS_CODE;
        files["server.cjs"] = portNormalized.includes("node:sqlite")
            ? portNormalized.replace(/['"]node:sqlite['"]/g, "'./sqlite-shim.cjs'")
            : portNormalized;
        files["server.js"] = portNormalized;
    } else {
        files["sqlite-shim.js"] = SQLITE_SHIM_CODE;
        files["server.js"] = portNormalized.includes("node:sqlite")
            ? portNormalized.replace(/['"]node:sqlite['"]/g, "'./sqlite-shim.js'")
            : portNormalized;
    }

    return { isCjs, files };
}

export function buildBackendSupervisorCommand(baseDir = "/home/user/app"): string {
    return `cd ${baseDir} && if [ -f server.cjs ]; then (nohup bash -c 'while true; do env PORT=3001 BACKEND_PORT=3001 node server.cjs >> /tmp/backend.log 2>&1; sleep 1; done' > /dev/null 2>&1 &); elif [ -f server.js ]; then (nohup bash -c 'while true; do env PORT=3001 BACKEND_PORT=3001 node server.js >> /tmp/backend.log 2>&1; sleep 1; done' > /dev/null 2>&1 &); fi`;
}

export function buildViteSupervisorCommand(baseDir = "/home/user/app"): string {
    return `cd ${baseDir} && (nohup bash -c 'export NODE_OPTIONS="--max-old-space-size=384"; while true; do (./node_modules/.bin/vite --host 0.0.0.0 --port 3000 || npx --yes vite --host 0.0.0.0 --port 3000) >> /tmp/dev-server.log 2>&1; sleep 1; done' > /dev/null 2>&1 &)`;
}

/**
 * Writes virtual files to disk inside the sandbox and ensures standard configuration files
 */
export async function writeFilesToSandbox(
    sandbox: Sandbox,
    fileData: FileData,
    baseDir = "/home/user/app"
): Promise<{ stack: "python" | "react-node" }> {
    const rawFiles = fileData.files ?? {};
    const stack = detectStack(rawFiles);

    // Normalize paths and store unique file contents
    const normalizedFiles: Record<string, string> = {};
    for (const [rawPath, fileObj] of Object.entries(rawFiles)) {
        const cleanPath = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
        let code = fileObj?.code ?? "";
        if (cleanPath.endsWith(".jsx") || cleanPath.endsWith(".tsx") || cleanPath.endsWith(".js") || cleanPath.endsWith(".ts")) {
            // Clean up accidental LLM escape artifacts in JSX code (e.g. `\ />` or `\ >`)
            code = code.replace(/\\\s*(\/?>)/g, " $1");
            if (cleanPath.startsWith("src/")) {
                code = normalizeClientApiUrls(code);
            }
        }
        normalizedFiles[cleanPath] = code;
    }

    if (stack === "react-node") {
        // Strict de-duplication: Canonicalize App.jsx into src/App.jsx
        if (normalizedFiles["App.jsx"]) {
            if (!normalizedFiles["src/App.jsx"]) {
                normalizedFiles["src/App.jsx"] = normalizeClientApiUrls(normalizedFiles["App.jsx"]);
            }
            delete normalizedFiles["App.jsx"];
        }

        // Canonicalize root components/* into src/components/*
        for (const path of Object.keys(normalizedFiles)) {
            if (path.startsWith("components/")) {
                const newPath = "src/" + path;
                if (!normalizedFiles[newPath]) {
                    normalizedFiles[newPath] = normalizeClientApiUrls(normalizedFiles[path]);
                }
                delete normalizedFiles[path];
            }
        }

        // Strictly enforce allowedHosts: true, polling, database.json ignore, and HMR in vite.config
        let hasViteConfig = false;
        for (const [key, code] of Object.entries(normalizedFiles)) {
            if (key === "vite.config.js" || key === "vite.config.ts" || key === "vite.config.mjs") {
                hasViteConfig = true;
                if (
                    !code.includes("allowedHosts: true") ||
                    !code.includes("usePolling") ||
                    !code.includes("clientPort: 443") ||
                    !code.includes("database.json")
                ) {
                    normalizedFiles[key] = STANDARD_VITE_CONFIG;
                }
            }
        }
        if (!hasViteConfig) {
            normalizedFiles["vite.config.js"] = STANDARD_VITE_CONFIG;
        }

        // Ensure index.html exists and has the Zephyre Error Bridge attached
        let indexHtml = normalizedFiles["index.html"] || normalizedFiles["public/index.html"];
        if (!indexHtml) {
            indexHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${fileData.title || "Zephyre App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${ZEPHYRE_ERROR_BRIDGE_SCRIPT}
  </head>
  <body class="bg-black text-white">
    <div id="root">
      ${ZEPHYRE_INITIAL_LOADER}
    </div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`.trim();
            normalizedFiles["index.html"] = indexHtml;
        } else {
            if (indexHtml.includes('id="zephyre-error-bridge"')) {
                indexHtml = indexHtml.replace(/<script id="zephyre-error-bridge">[\s\S]*?<\/script>/, ZEPHYRE_ERROR_BRIDGE_SCRIPT);
            } else if (indexHtml.includes("</head>")) {
                indexHtml = indexHtml.replace("</head>", `${ZEPHYRE_ERROR_BRIDGE_SCRIPT}\n</head>`);
            } else {
                indexHtml = `${ZEPHYRE_ERROR_BRIDGE_SCRIPT}\n${indexHtml}`;
            }

            // Ensure root container has a loading indicator before React mounts
            if (indexHtml.includes('<div id="root"></div>')) {
                indexHtml = indexHtml.replace('<div id="root"></div>', `<div id="root">${ZEPHYRE_INITIAL_LOADER}</div>`);
            } else if (indexHtml.includes('<div id="root"> </div>')) {
                indexHtml = indexHtml.replace('<div id="root"> </div>', `<div id="root">${ZEPHYRE_INITIAL_LOADER}</div>`);
            }
            normalizedFiles["index.html"] = indexHtml;
        }
        delete normalizedFiles["public/index.html"];

        // Ensure canonical main.jsx with imports at the top, HMR error reporting, and ZephyreErrorBoundary
        const hasCss = Boolean(
            normalizedFiles["src/index.css"] ||
            normalizedFiles["index.css"] ||
            normalizedFiles["src/App.css"] ||
            normalizedFiles["App.css"]
        );
        const cssImport = hasCss
            ? (normalizedFiles["src/index.css"] ? "import './index.css';\n" : (normalizedFiles["index.css"] ? "import '../index.css';\n" : ""))
            : "";

        normalizedFiles["src/main.jsx"] = `
import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
${cssImport}
${ZEPHYRE_HMR_REPORTER_CODE}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <ZephyreErrorBoundary>
        <App />
      </ZephyreErrorBoundary>
    </StrictMode>
  );
  zephyreVerifyRenderedRoot(rootElement);
}
`.trim();
        delete normalizedFiles["main.jsx"];

        // Prepare Express backend files (with automatic .cjs support if require() is used)
        let isCjsBackend = false;
        if (normalizedFiles["server.js"]) {
            const prepared = prepareBackendServerFiles(normalizedFiles["server.js"]);
            isCjsBackend = prepared.isCjs;
            Object.assign(normalizedFiles, prepared.files);
        }

        // Ensure package.json exists and is normalized
        const rawPkgCode = normalizedFiles["package.json"];
        const hasServerJs = Boolean(normalizedFiles["server.js"]);
        const serverEntry = isCjsBackend ? "server.cjs" : "server.js";
        const backendDeps: Record<string, string> = hasServerJs
            ? { express: "^4.21.2", cors: "^2.8.5" }
            : {};
        const devScript = hasServerJs
            ? `PORT=3001 node ${serverEntry} & vite --host 0.0.0.0 --port 3000`
            : "vite --host 0.0.0.0 --port 3000";

        let packageJson: {
            name?: string;
            version?: string;
            type?: string;
            scripts?: Record<string, string>;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        } | null = null;

        if (rawPkgCode) {
            try {
                packageJson = JSON.parse(rawPkgCode);
            } catch {
                packageJson = null;
            }
        }

        const userDeps = fileData.dependencies ?? {};
        if (!packageJson) {
            packageJson = {
                name: "zephyre-app",
                version: "1.0.0",
                type: "module",
                scripts: {
                    dev: devScript,
                    build: "vite build",
                    start: `node ${serverEntry}`,
                },
                dependencies: {
                    react: "^19.0.0",
                    "react-dom": "^19.0.0",
                    "lucide-react": "^1.16.0",
                    clsx: "^2.1.1",
                    "tailwind-merge": "^3.0.0",
                    ...backendDeps,
                    ...userDeps,
                },
                devDependencies: {
                    "@vitejs/plugin-react": "^4.3.4",
                    vite: "^6.0.0",
                },
            };
        } else {
            packageJson.type = "module";
            packageJson.scripts = packageJson.scripts || {};
            packageJson.scripts.dev = devScript;
            if (hasServerJs) {
                packageJson.scripts.start = `node ${serverEntry}`;
            }
            packageJson.dependencies = {
                react: "^19.0.0",
                "react-dom": "^19.0.0",
                "lucide-react": "^1.16.0",
                clsx: "^2.1.1",
                "tailwind-merge": "^3.0.0",
                ...backendDeps,
                ...(packageJson.dependencies || {}),
                ...userDeps,
            };
            packageJson.devDependencies = {
                "@vitejs/plugin-react": "^4.3.4",
                vite: "^6.0.0",
                ...(packageJson.devDependencies || {}),
            };
        }

        normalizedFiles["package.json"] = JSON.stringify(packageJson, null, 2);
    }

    // Ensure working directory exists and any standard directories
    await sandbox.commands.run(`mkdir -p ${baseDir}/src ${baseDir}/components ${baseDir}/public`);

    // Create subdirectories for nested files in a single batched command
    const dirs = new Set<string>();
    const safeFiles: Record<string, string> = {};

    for (const [cleanPath, code] of Object.entries(normalizedFiles)) {
        const safePath = sanitizeSandboxPath(cleanPath);
        if (!safePath) continue;
        safeFiles[safePath] = code;

        const lastSlash = safePath.lastIndexOf("/");
        if (lastSlash !== -1) {
            dirs.add(`${baseDir}/${safePath.slice(0, lastSlash)}`);
        }
    }

    if (dirs.size > 0) {
        const dirList = Array.from(dirs).map((d) => `"${d}"`).join(" ");
        await sandbox.commands.run(`mkdir -p ${dirList}`);
    }

    // Write all normalized files exactly once (zero race conditions)
    const writePromises = Object.entries(safeFiles).map(([safePath, code]) =>
        sandbox.files.write(`${baseDir}/${safePath}`, code)
    );
    await Promise.all(writePromises);

    return { stack };
}

/**
 * Ensures sufficient Linux swap space (1024MB) is active inside the sandbox container.
 * This guarantees esbuild pre-bundling of large libraries (like Three.js or Recharts)
 * will never be terminated by the Linux kernel OOM killer on 512MB microVMs.
 */
export async function ensureSandboxSwap(sandbox: Sandbox): Promise<void> {
    try {
        await sandbox.commands.run(`
            if [ ! -f /swapfile ]; then
                sudo fallocate -l 1024M /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
                sudo chmod 600 /swapfile
                sudo /sbin/mkswap /swapfile 2>/dev/null || sudo mkswap /swapfile
                sudo /sbin/swapon /swapfile 2>/dev/null || sudo swapon /swapfile
            fi
        `, { timeoutMs: 25_000 });
    } catch (err) {
        console.warn("[E2B] Swap configuration notice:", err);
    }
}

/**
 * Boots the dev server or application in the background, waits for port readiness,
 * and returns the live preview URL along with traffic token details
 */
export async function startSandboxApp(
    sandbox: Sandbox,
    stack: "python" | "react-node",
    baseDir = "/home/user/app"
): Promise<{ previewUrl: string; trafficAccessToken?: string; isPublic: boolean }> {
    // 1. Provision 1024MB swap to guarantee memory safety for heavy package installations and builds
    await ensureSandboxSwap(sandbox);

    if (stack === "python") {
        // Install requirements if present
        await sandbox.commands.run(`cd ${baseDir} && if [ -f requirements.txt ]; then pip install -r requirements.txt; fi`);
        // Start FastAPI / Flask / Python script with log redirection
        await sandbox.commands.run(
            `cd ${baseDir} && if [ -f main.py ]; then python3 main.py > /tmp/app.log 2>&1; elif [ -f app.py ]; then python3 app.py > /tmp/app.log 2>&1; fi`,
            { background: true }
        );
    } else {
        // Install dependencies and surface real installation failures instead of failing silently
        const installResult = await sandbox.commands.run(
            `cd ${baseDir} && (npm install --no-audit --no-fund --legacy-peer-deps > /tmp/npm-install.log 2>&1 || npm install --no-audit --no-fund --force >> /tmp/npm-install.log 2>&1 || echo "NPM_INSTALL_FAILED")`,
            { timeoutMs: 120_000 }
        );
        if (installResult.stdout.includes("NPM_INSTALL_FAILED")) {
            const installLog = await sandbox.commands
                .run("tail -n 30 /tmp/npm-install.log 2>&1 || true")
                .catch(() => null);
            const logSnippet = installLog?.stdout?.trim() || "";
            console.error(`[E2B] npm install failed in ${baseDir}:`, logSnippet);
            const hasViteBin = await sandbox.commands
                .run(`test -x ${baseDir}/node_modules/.bin/vite && echo OK || true`)
                .catch(() => null);
            if (!hasViteBin?.stdout.includes("OK")) {
                throw new Error(
                    `Sandbox dependency installation failed: ${logSnippet.slice(-400) || "npm install exited with non-zero status"}`
                );
            }
        }
        // Ensure both ports 3000 and 3001 are clean and dev server logs exist
        await sandbox.commands.run(
            `touch /tmp/dev-server.log /tmp/backend.log; (fuser -k 3000/tcp 2>/dev/null || true); (fuser -k 3001/tcp 2>/dev/null || true)`
        );
        // Start Node/Express backend strictly on port 3001 with supervisor if server.cjs/server.js exists
        await sandbox.commands.run(buildBackendSupervisorCommand(baseDir));
        // Start Vite dev server explicitly on port 3000 with local binary priority and supervisor
        await sandbox.commands.run(buildViteSupervisorCommand(baseDir));
    }

    // Wait up to 30 seconds for dev server readiness and warm critical entrypoints & optimized deps
    let isReady = false;
    try {
        await sandbox.commands.run(
            `for i in $(seq 1 60); do
                if curl -s -f http://127.0.0.1:3000/ > /dev/null 2>&1 || curl -s -f http://localhost:3000/ > /dev/null 2>&1; then
                    curl -s http://127.0.0.1:3000/@vite/client > /dev/null 2>&1 || true
                    curl -s http://127.0.0.1:3000/src/main.jsx > /dev/null 2>&1 || true
                    curl -s http://127.0.0.1:3000/src/App.jsx > /dev/null 2>&1 || true
                    exit 0
                fi
                sleep 0.5
            done; exit 1`,
            { timeoutMs: 35_000 }
        );
        isReady = true;
    } catch {
        // Dev server startup check timed out; attempt quick kickstart
        console.warn("[E2B] Dev server initial warm-up notice, executing kickstart...");
        try {
            await sandbox.commands.run(buildViteSupervisorCommand(baseDir));
            await sandbox.commands.run(
                `for i in $(seq 1 20); do
                    if curl -s -f http://127.0.0.1:3000/ > /dev/null 2>&1; then
                        curl -s http://127.0.0.1:3000/@vite/client > /dev/null 2>&1 || true
                        curl -s http://127.0.0.1:3000/src/main.jsx > /dev/null 2>&1 || true
                        exit 0
                    fi
                    sleep 0.5
                done; exit 1`,
                { timeoutMs: 14_000 }
            );
            isReady = true;
        } catch {
            isReady = false;
        }
    }

    if (!isReady) {
        const log = await sandbox.commands.run("tail -n 25 /tmp/dev-server.log 2>&1 || true").catch(() => null);
        const logText = log?.stdout?.trim() || "";
        throw new Error(`Development server failed to boot on port 3000: ${logText.slice(0, 300) || "Port 3000 connection refused"}`);
    }

    // Port 3000 is the standard preview port
    const host = sandbox.getHost(3000);
    const trafficAccessToken = sandbox.trafficAccessToken;
    return {
        previewUrl: `https://${host}`,
        trafficAccessToken,
        isPublic: !trafficAccessToken,
    };
}
