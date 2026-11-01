'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type HexagonBackgroundProps = React.ComponentProps<'div'> & {
  hexagonProps?: React.ComponentProps<'div'>;
  hexagonSize?: number;
  hexagonMargin?: number;
  responsive?: boolean;
};

function HexagonBackground({
  className,
  children,
  hexagonProps,
  hexagonSize = 60,
  hexagonMargin = 2.5,
  responsive = true,
  ...props
}: HexagonBackgroundProps) {
  const subscribe = React.useCallback((callback: () => void) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  }, []);

  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined') return '0x0x60';
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Responsive hexagon sizing: 42px on mobile (<640), 52px on tablet (<1024), 60px on desktop
    const effectiveSize = responsive
      ? width < 640
        ? 42
        : width < 1024
          ? 52
          : hexagonSize
      : hexagonSize;

    const rowSpacing = effectiveSize * 0.8;
    // Cover the full height of the section even on mobile where content expands
    const r = Math.ceil(Math.max(height, 1000) / rowSpacing) + 3;
    const c = Math.ceil(width / effectiveSize) + 3;
    return `${r}x${c}x${effectiveSize}`;
  }, [hexagonSize, responsive]);

  const getServerSnapshot = React.useCallback(() => `0x0x${hexagonSize}`, [hexagonSize]);

  const dimensionsStr = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [rows, columns, currentHexSize] = React.useMemo(() => {
    const [r, c, s] = dimensionsStr.split('x').map(Number);
    return [r || 0, c || 0, s || hexagonSize];
  }, [dimensionsStr, hexagonSize]);

  const hexagonWidth = currentHexSize;
  const hexagonHeight = currentHexSize * 1.1;
  const baseMarginTop = -36 - 0.275 * (currentHexSize - 100);
  const computedMarginTop = baseMarginTop + hexagonMargin;
  const oddRowMarginLeft = -(currentHexSize / 2);
  const evenRowMarginLeft = hexagonMargin / 2;

  // Touch-drag interaction for mobile screens
  const handleTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.getAttribute('data-hexagon') === 'true') {
      element.classList.add('is-touched');
      setTimeout(() => {
        element.classList.remove('is-touched');
      }, 700);
    }
  }, []);

  return (
    <div
      data-slot="hexagon-background"
      className={cn(
        'relative size-full overflow-hidden dark:bg-neutral-900 bg-neutral-100',
        className,
      )}
      {...props}
    >
      <style>{`:root { --hexagon-margin: ${hexagonMargin}px; }`}</style>
      <div
        className="absolute top-0 left-0 size-full overflow-hidden pointer-events-auto"
        onTouchMove={handleTouchMove}
      >
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            style={{
              marginTop: computedMarginTop,
              marginLeft:
                ((rowIndex + 1) % 2 === 0
                  ? evenRowMarginLeft
                  : oddRowMarginLeft) - 10,
            }}
            className="inline-flex"
          >
            {Array.from({ length: columns }).map(
              (_, colIndex) => (
                <div
                  key={`hexagon-${rowIndex}-${colIndex}`}
                  data-hexagon="true"
                  {...hexagonProps}
                  style={{
                    width: hexagonWidth,
                    height: hexagonHeight,
                    marginLeft: hexagonMargin,
                    ...hexagonProps?.style,
                  }}
                  className={cn(
                    'relative transition-transform duration-300',
                    '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                    "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-full dark:before:bg-orange-500/25 before:bg-neutral-300 before:opacity-100 before:transition-all before:duration-700",
                    "after:content-[''] after:absolute after:inset-(--hexagon-margin) dark:after:bg-[#050508] after:bg-white",
                    'after:[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                    'hover:before:bg-orange-500 hover:before:opacity-100 hover:before:duration-0 dark:hover:after:bg-orange-950/60 hover:after:bg-orange-100 hover:after:opacity-100 hover:after:duration-0',
                    'active:before:bg-orange-500 active:before:opacity-100 active:before:duration-0 dark:active:after:bg-orange-950/60 active:after:bg-orange-100 active:after:opacity-100 active:after:duration-0',
                    '[&.is-touched]:before:bg-orange-500 [&.is-touched]:before:opacity-100 [&.is-touched]:before:duration-0 dark:[&.is-touched]:after:bg-orange-950/60 dark:[&.is-touched]:after:opacity-100 dark:[&.is-touched]:after:duration-0',
                    'hover:scale-105 active:scale-105 [&.is-touched]:scale-105 cursor-pointer',
                    hexagonProps?.className,
                  )}
                />
              ),
            )}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export { HexagonBackground, type HexagonBackgroundProps };
