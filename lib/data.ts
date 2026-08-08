import { Sparkles, Zap, Code2, Eye, Package, ImageIcon } from "lucide-react";

export const SUGGESTIONS = [
    { text: "A Spotify stats dashboard with charts & audio visualizer", tag: "Music", icon: "🎵" },
    { text: "A kanban task board with drag & drop and analytics", tag: "Productivity", icon: "📋" },
    { text: "A weather app with 3D animated radar & forecast cards", tag: "Dashboard", icon: "⛅" },
    { text: "A personal finance tracker with monthly budget breakdowns", tag: "Finance", icon: "💰" },
    { text: "A recipe finder with AI nutrition macro calculation", tag: "Health", icon: "🍳" },
    { text: "A pomodoro productivity timer with custom soundscapes", tag: "Tools", icon: "⏱️" },
    { text: "An AI landing page builder with live theme toggle", tag: "AI App", icon: "🚀" },
    { text: "A ChatGPT clone with custom system prompts & model picker", tag: "AI App", icon: "🤖" },
    { text: "A real-time crypto & stock market portfolio dashboard", tag: "Finance", icon: "📈" },
    { text: "A habit streak tracker with GitHub-style heatmaps", tag: "Productivity", icon: "🧘" },
    { text: "An e-commerce storefront with cart & instant checkout", tag: "E-Commerce", icon: "🛒" },
    { text: "A retro pixel arcade game with high scores & sound FX", tag: "Gaming", icon: "🎮" },
    { text: "A markdown note-taking app with split-screen live preview", tag: "Developer", icon: "📝" },
    { text: "A lo-fi ambient audio player with audio visualizer", tag: "Audio", icon: "🎧" },
    { text: "A travel itinerary planner & real-time flight search", tag: "Travel", icon: "✈️" },
    { text: "An interactive canvas whiteboard with drawing & export", tag: "Design", icon: "🎨" },
];

export const FEATURES = [
    {
        icon: Zap,
        label: "Instant generation",
        desc: "Describe your app in plain English. Gemini 3.5 Flash returns production-ready React + Tailwind code in seconds.",
    },
    {
        icon: Eye,
        label: "Live preview",
        desc: "Your app renders instantly in the browser via Sandpack. No install, no build step — just a working preview.",
    },
    {
        icon: Code2,
        label: "Full source code",
        desc: "Browse every generated file. Edit directly in the built-in editor and watch the preview update in real time.",
    },
    {
        icon: Package,
        label: "Smart packages",
        desc: "AI picks the right npm packages. We validate them against the npm registry and filter hallucinated ones silently.",
    },
    {
        icon: Sparkles,
        label: "AI error recovery",
        desc: "When your preview throws an error, a banner appears. One click sends the error to AI and auto-fixes the code.",
    },
    {
        icon: ImageIcon,
        label: "Image-aware prompts",
        desc: "Attach screenshots or mockups to your prompt. The AI reads them and generates code that matches your design.",
    },
];

export const STEPS = [
    {
        number: "01",
        label: "Describe your app",
        desc: "Type a prompt or pick a suggestion. Add screenshots for extra context.",
    },
    {
        number: "02",
        label: "AI generates code",
        desc: "Gemini writes React + Tailwind components, picks dependencies, and structures your files.",
    },
    {
        number: "03",
        label: "Preview & refine",
        desc: "See your app live instantly. Keep chatting to iterate — AI remembers the full conversation.",
    },
    {
        number: "04",
        label: "Export and deploy",
        desc: "Open in CodeSandbox, copy the source, and deploy to a live URL.",
    },
];

export const PLACEHOLDERS = [
    "A task manager with priority labels and drag-and-drop…",
    "A crypto portfolio tracker with live charts…",
    "A markdown notes app with live preview…",
    "An expense tracker with monthly breakdowns…",
    "A habit tracker with streaks and heatmaps…",
];

export const FAQS = [
  {
    question: "Do I need design or coding skills to use this?",
    answer: "No. Zephyre AI is designed for both beginners and professionals. You can start with AI-generated structures and customize them visually or hand them off to designers and developers."
  },
  {
    question: "How does the AI website builder work?",
    answer: "Zephyre AI analyzes your prompt to generate full sitemaps, wireframes, style guides, and production-ready Next.js code tailored to your brand in seconds."
  },
  {
    question: "What are daily credits and how do they work?",
    answer: "Daily credits let you generate and iterate on websites every day. Free accounts receive 10 generations upon sign up, and paid plans unlock unlimited daily credits."
  },
  {
    question: "Can I collaborate with my team?",
    answer: "Yes! You can share workspace links, invite team members, leave real-time feedback, and export assets together."
  },
  {
    question: "Can I export my designs to other tools?",
    answer: "Absolutely. You can export clean React/Next.js TypeScript code, CSS styles, or copy raw HTML directly into your favorite editors."
  },
  {
    question: "Is my data private and secure?",
    answer: "Yes. We take security seriously. All generated code and uploaded assets are privately encrypted and never sold or shared with third parties."
  }
];