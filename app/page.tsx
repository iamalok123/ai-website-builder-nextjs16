"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import {
  ArrowRight,
  Zap,
  ChevronRight,
  Check,
  Sparkles,
  MousePointer2,
  Folder,
  File,
  FileCode,
  Search,
  GitBranch,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HexagonBackground } from "@/components/animate-ui/components/backgrounds/hexagon";
import { FAQS, PLACEHOLDERS, STEPS, SUGGESTIONS } from "@/lib/data";
import { PRICING_PLANS } from "@/lib/constants";

export default function Home() {
  const { isSignedIn, has } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [hoveredFeatureCard, setHoveredFeatureCard] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // placeholder effect
  useEffect(() => {
    if (isFocused || prompt) return;
    const t = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(t);
  }, [isFocused, prompt]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [prompt]);

  const handleSubmit = () => {
    if (!prompt.trim() || !isSignedIn) return;
    router.push(`/workspace?prompt=${encodeURIComponent(prompt.trim())}`);
  };


  // Enter button -> SUbmit
  // Shift + Enter -> New line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (s: string) => {
    setPrompt(s);
    textareaRef.current?.focus();
  };

  const handleShuffleCards = () => {
    setIsShuffled((prev) => !prev);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    setMouseOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  return (
    <main className='min-h-screen bg-black text-white selection:bg-orange-500/30 selection:text-orange-200'>

      {/* HERO SECTION - HEXAGON BACKGROUND WITH ORANGE THEME & MATCHING INTERFACE */}
      <section id="hero" className="relative min-h-dvh sm:min-h-0 pt-20 sm:pt-24 pb-8 sm:pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center justify-center">

        {/* Ambient Radial Spotlight Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-112 w-md rounded-full bg-orange-600/20 blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-130 rounded-full bg-amber-500/15 blur-[110px] pointer-events-none" />

        {/* Hexagon Background replacing HoleBackground */}
        <HexagonBackground
          hexagonSize={60}
          hexagonMargin={2.5}
          className="absolute inset-0 h-full w-full opacity-70 dark:bg-transparent bg-transparent z-0"
          style={{
            maskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 65%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 65%, transparent 100%)",
          }}
        />

        {/* Hero Content Wrapper */}
        <div className="relative w-full flex flex-col items-center text-center justify-center transition-all z-10 pointer-events-none">

          {/* Main Hero Headline */}
          <h1 className="z-10 mx-auto max-w-4xl text-balance font-sans text-3xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.2] sm:leading-[1.08] drop-shadow-sm mb-2 sm:mb-0">
            AI-Powered{" "}
            <span className="bg-linear-to-r from-orange-400 via-amber-400 to-red-400 bg-clip-text text-transparent">
              Website Builder
            </span>
            <br />
            For Faster Launches
          </h1>

          {/* Subtitle */}
          <p className="z-10 mx-auto mt-2 sm:mt-5 max-w-xs sm:max-w-2xl text-balance text-xs sm:text-base leading-relaxed text-zinc-400 font-normal relative px-2">
            Just describe what you want to build, and Zephyre AI creates a clear, organized website structure you can immediately customize and export.
          </p>

          {/* ── AI WEBSITE GENERATOR INPUT PROMPT CONTAINER ────────────────── */}
          <div className="z-20 mt-6 sm:mt-12 w-full max-w-2xl relative px-1 sm:px-0 pointer-events-auto">

            {/* Glowing Gradient Border Wrapper */}
            <div className="p-[2.5px] rounded-2xl bg-linear-to-r from-amber-500/80 via-orange-500/80 to-red-500/80 shadow-[0_0_40px_rgba(249,115,22,0.35)] hover:shadow-[0_0_60px_rgba(249,115,22,0.5)] transition-all duration-300">

              <div className="rounded-[13px] bg-[#0d0a08]/95 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-3">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Describe a company in a sentence or two..."
                  rows={1}
                  className="w-full resize-none bg-transparent px-1 sm:px-2 text-xs sm:text-base placeholder:text-zinc-500 text-white focus:outline-none"
                  style={{ minHeight: 48, maxHeight: 180 }}
                />

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-white/10 pt-3 sm:pt-3 gap-2.5 sm:gap-0">
                  <span className="text-[11px] sm:text-xs text-zinc-500 text-left hidden sm:inline">
                    Press ⏎ to generate · Shift+⏎ for new line
                  </span>

                  {isSignedIn ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={!prompt.trim()}
                      className="w-full sm:w-auto h-10 rounded-xl px-5 sm:px-6 text-xs sm:text-sm font-semibold bg-linear-to-r from-amber-500 via-orange-500 to-red-500 hover:brightness-110 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 border-0"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </Button>
                  ) : (
                    <SignInButton mode="modal">
                      <Button className="w-full sm:w-auto h-10 rounded-xl px-5 sm:px-6 text-xs sm:text-sm font-semibold bg-linear-to-r from-amber-500 via-orange-500 to-red-500 hover:brightness-110 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-0">
                        <Sparkles className="h-4 w-4" />
                        Generate
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            </div>

            {/* Suggestion Chips - Marquee on Mobile, Static Centered on Desktop */}
            {/* Desktop View */}
            <div className="mt-4 hidden sm:flex flex-wrap justify-center gap-2 pointer-events-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border border-white/8 bg-white/4 px-3.5 py-1.5 text-xs text-zinc-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Mobile Marquee Scrolling View */}
            <div className="mt-5 block sm:hidden overflow-hidden w-full max-w-full relative py-1 mask-[linear-gradient(to_right,transparent_0%,black_6%,black_94%,transparent_100%)] pointer-events-auto">
              <div
                className="animate-marquee-scroll flex w-max gap-2.5"
                style={{ animation: 'marquee 16s linear infinite' }}
              >
                {[...SUGGESTIONS, ...SUGGESTIONS, ...SUGGESTIONS].map((s, idx) => (
                  <button
                    key={`${s}-${idx}`}
                    onClick={() => handleSuggestion(s)}
                    className="shrink-0 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-orange-500/60 hover:bg-orange-950/40 hover:text-white transition-all cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 sm:mt-6 text-[11px] sm:text-xs text-zinc-400 z-10 font-medium">
            No credit card required · 10 free generations on sign up
          </p>

        </div>
      </section>


      {/* ── WORKSPACE MOCKUP ─────────────────────────── */}
      <section id="demo" className="pt-8 sm:pt-16 pb-12 sm:pb-32 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl sm:rounded-3xl border border-orange-500/30 bg-[#050507] shadow-[0_20px_70px_rgba(249,115,22,0.2)] backdrop-blur-2xl transition-all hover:border-orange-500/50 mb-10 sm:mb-16 group">

          {/* Orange Highlight Top Accent Bar */}
          <div className="h-1 sm:h-1.5 w-full bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 shadow-[0_2px_15px_rgba(249,115,22,0.6)]" />

          {/* Top Browser Control Bar */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#07070a] px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex gap-1.5 sm:gap-2">
              <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-rose-500/80 shadow-xs shadow-rose-500/50" />
              <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-500/80 shadow-xs shadow-amber-500/50" />
              <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500/80 shadow-xs shadow-emerald-500/50" />
            </div>

            <div className="mx-auto flex h-6 sm:h-7 w-40 sm:w-72 items-center justify-center rounded-lg border border-white/10 bg-white/4 px-2.5 sm:px-3 shadow-inner">
              <span className="text-[10px] sm:text-xs font-mono text-zinc-400 flex items-center gap-1.5 truncate">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400 animate-pulse" />
                zephyre.app/workspace
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row h-auto md:h-115">
            {/* Left Chat Panel */}
            <div className="flex w-full md:w-80 flex-col border-b md:border-b-0 md:border-r border-white/10 bg-[#070709] max-h-64 sm:max-h-72 md:max-h-none">
              <div className="border-b border-white/10 px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
                <p className="text-[11px] sm:text-xs uppercase tracking-wider font-extrabold text-orange-400">
                  AI Workspace Chat
                </p>
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              </div>

              <div className="flex-1 space-y-3 px-3 sm:px-3.5 py-3 overflow-y-auto">
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-55 rounded-2xl rounded-br-sm border border-orange-500/40 bg-linear-to-r from-orange-600/30 to-amber-600/30 px-3 py-2 shadow-md shadow-orange-900/20">
                    <p className="text-[11px] sm:text-xs text-orange-100 font-medium">
                      Build a kanban board with 3 columns and drag-and-drop
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="mt-0.5 flex h-5 sm:h-6 w-5 sm:w-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/30">
                    <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-white text-white" />
                  </div>

                  <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/4 px-3 py-2 backdrop-blur-sm">
                    <p className="text-[11px] sm:text-xs text-zinc-300 leading-relaxed">
                      I&apos;ll build a Kanban board with Todo, In Progress, and
                      Done columns. I&apos;ll use{" "}
                      <code className="text-orange-300 font-mono bg-orange-950/60 border border-orange-500/30 rounded px-1 py-0.5">@dnd-kit/core</code>{" "}
                      for smooth drag-and-drop…
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 px-3 py-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 shadow-inner">
                  <span className="flex-1 text-[11px] sm:text-xs text-zinc-500 font-medium truncate">
                    Ask AI to modify design…
                  </span>
                  <div className="h-5 sm:h-6 w-5 sm:w-6 rounded-lg bg-orange-500 hover:bg-orange-400 flex items-center justify-center text-white cursor-pointer transition-colors shrink-0">
                    <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Workspace Preview Grid */}
            <div className="flex flex-1 flex-col bg-[#030305]">
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#07070a] px-3 sm:px-4">
                <button className="border-b-2 border-orange-500 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-white bg-orange-500/10">
                  Live Preview
                </button>
                <button className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
                  Code Editor
                </button>
              </div>

              <div className="flex flex-1 gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar md:overflow-visible p-3 sm:p-5 snap-x snap-mandatory">
                {[
                  { name: "Todo", count: 3, badge: "bg-amber-500/20 text-amber-300 border-amber-500/40", bar: "bg-amber-400" },
                  { name: "In Progress", count: 2, badge: "bg-orange-500/20 text-orange-300 border-orange-500/40", bar: "bg-orange-400" },
                  { name: "Done", count: 1, badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", bar: "bg-emerald-400" },
                ].map((col) => (
                  <div key={col.name} className="flex w-[78vw] max-w-xs sm:w-1/3 shrink-0 sm:shrink flex-col gap-2 sm:gap-2.5 rounded-2xl sm:rounded-xl border border-white/10 bg-[#0a0a0e] p-3 sm:p-3 shadow-inner snap-center">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs uppercase tracking-wider font-extrabold text-white">
                        {col.name}
                      </span>

                      <span className={cn("rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-bold", col.badge)}>
                        {col.count}
                      </span>
                    </div>

                    {Array.from({ length: col.count }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-white/10 bg-[#0f0f16] p-2.5 sm:p-3 shadow-md hover:border-orange-500/40 transition-all"
                      >
                        <div
                          className={cn("mb-1.5 sm:mb-2 h-2 rounded-full", col.bar)}
                          style={{ width: `${65 + i * 12}%` }}
                        />
                        <div className="h-1.5 w-3/4 rounded-full bg-zinc-700/50" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── FEATURES SECTION ────────────────────────────────────────────────── */}
      <section id="features" className="px-4 sm:px-6 pb-20 sm:pb-32 max-w-6xl mx-auto relative">
        <div className="flex flex-col items-center text-center mb-10 sm:mb-14">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-px w-5 bg-linear-to-r from-transparent to-orange-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              FEATURES
            </span>
            <span className="h-px w-5 bg-linear-to-l from-transparent to-orange-500" />
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Everything You Need to Ship Faster
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
            Designed for founders, designers, and teams who value speed, quality, and clarity.
          </p>
        </div>

        {/* 2x2 Feature Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-7 max-w-6xl mx-auto items-stretch">

          {/* Feature Card 1: Sitemaps / Instant Generation */}
          <div className="group rounded-3xl border border-white/10 bg-[#090a0f]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-xl hover:border-orange-500/40 hover:bg-[#0d0e16] hover:shadow-[0_15px_50px_rgba(249,115,22,0.15)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
                Instant AI Generation
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal mb-6">
                Describe your website in plain English. Gemini AI returns production-ready Next.js, React, and Tailwind code with clear page structures in seconds.
              </p>
            </div>

            {/* Graphic 1: Sitemap Tree Graphic */}
            <div className="rounded-2xl border border-zinc-800/80 bg-[#07080d]/80 p-5 flex flex-col items-center relative overflow-hidden shadow-inner min-h-52.5 justify-center">
              {/* Root node */}
              <div className="px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-700/80 text-zinc-300 text-xs font-semibold flex items-center gap-2 shadow-md z-10">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                Sitemap
              </div>

              {/* Connecting line */}
              <div className="h-6 w-0.5 bg-linear-to-b from-orange-500/80 to-zinc-800 relative my-1">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
              </div>

              {/* Flowchart items */}
              <div className="w-full max-w-xs space-y-1.5 z-10">
                {["01. Hero Section", "02. How It Works", "03. Features", "04. Pricing"].map((node) => (
                  <div
                    key={node}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3.5 py-1.5 text-xs font-medium text-zinc-400 flex items-center justify-between hover:border-orange-500/40 hover:text-zinc-200 transition-colors"
                  >
                    <span>{node}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 group-hover:bg-orange-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Card 2: UX-First Wireframes / Live Preview */}
          <div className="group rounded-3xl border border-white/10 bg-[#090a0f]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-xl hover:border-orange-500/40 hover:bg-[#0d0e16] hover:shadow-[0_15px_50px_rgba(249,115,22,0.15)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
                Live Preview & Wireframes
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal mb-6">
                Your app renders instantly in the browser with UX best practices. No install or build steps — navigate smoothly and refine in real time.
              </p>
            </div>

            {/* Graphic 2: Wireframe Canvas Graphic */}
            <div className="rounded-2xl border border-zinc-800/80 bg-[#07080d]/80 p-5 relative min-h-52.5 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Corner node markers */}
              <div className="absolute top-3 left-3 h-2 w-2 rounded-xs border border-orange-500/60 bg-orange-500/20" />
              <div className="absolute top-3 right-3 h-2 w-2 rounded-xs border border-orange-500/60 bg-orange-500/20" />
              <div className="absolute bottom-3 left-3 h-2 w-2 rounded-xs border border-orange-500/60 bg-orange-500/20" />
              <div className="absolute bottom-3 right-3 h-2 w-2 rounded-xs border border-orange-500/60 bg-orange-500/20" />

              {/* Wireframe Grid Skeletons */}
              <div className="flex gap-3 h-32 w-full my-auto">
                <div className="flex-1 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 flex flex-col gap-2">
                  <div className="h-3 w-1/2 rounded bg-zinc-800/80" />
                  <div className="h-2 w-3/4 rounded bg-zinc-800/50" />
                  <div className="h-12 w-full rounded bg-zinc-800/30 mt-auto" />
                </div>
                <div className="w-28 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 flex flex-col gap-2">
                  <div className="h-3 w-3/4 rounded bg-zinc-800/80" />
                  <div className="h-2 w-full rounded bg-zinc-800/50" />
                  <div className="h-2 w-2/3 rounded bg-zinc-800/50" />
                </div>
              </div>

              {/* Bottom Badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3.5 py-1 text-[11px] font-semibold text-orange-400 shadow-md self-center z-10">
                <Sparkles className="h-3 w-3 text-orange-400" /> Generate Wireframes
              </div>
            </div>
          </div>

          {/* Feature Card 3: Full Source Code / Ready-to-Design */}
          <div className="group rounded-3xl border border-white/10 bg-[#090a0f]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-xl hover:border-orange-500/40 hover:bg-[#0d0e16] hover:shadow-[0_15px_50px_rgba(249,115,22,0.15)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
                Full Source Code Access
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal mb-6">
                Browse every generated file. Edit directly in the built-in code editor with clean structure, ready for design handoffs or exports.
              </p>
            </div>

            {/* Graphic 3: Code Panel Graphic */}
            <div className="rounded-2xl border border-zinc-800/80 bg-[#07080d]/80 p-4 relative min-h-52.5 overflow-hidden shadow-inner text-left font-mono text-[11px]">
              <div className="flex items-center justify-between text-zinc-500 border-b border-zinc-800/80 pb-2 mb-3">
                <span className="text-zinc-300 font-semibold">main.tsx</span>
                <span className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer">Revert</span>
              </div>

              <div className="space-y-1 text-zinc-400 leading-relaxed">
                <div><span className="text-amber-400">return</span> (</div>
                <div className="pl-3 text-zinc-500">&lt;<span className="text-orange-400">BrowserRouter</span>&gt;</div>
                <div className="pl-6 text-zinc-500">&lt;<span className="text-orange-400">Routes</span>&gt;</div>
                <div className="pl-9">&lt;<span className="text-purple-300">Route</span> path=<span className="text-emerald-400">&quot;/&quot;</span> element=&#123;&lt;Home /&gt;&#125; /&gt;</div>
                <div className="pl-9">&lt;<span className="text-purple-300">Route</span> path=<span className="text-emerald-400">&quot;/login&quot;</span> element=&#123;&lt;Login /&gt;&#125; /&gt;</div>
                <div className="pl-6 text-zinc-500">&lt;/<span className="text-orange-400">Routes</span>&gt;</div>
              </div>

              {/* Dev Mode Badge */}
              <div className="absolute bottom-3 right-3 z-10 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[10px] font-bold text-orange-400 flex items-center gap-1 shadow-lg">
                <Zap className="h-3 w-3 text-orange-400" /> Dev mode
              </div>
            </div>
          </div>

          {/* Feature Card 4: Smart Packages & Real-Time Sync */}
          <div className="group rounded-3xl border border-white/10 bg-[#090a0f]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-xl hover:border-orange-500/40 hover:bg-[#0d0e16] hover:shadow-[0_15px_50px_rgba(249,115,22,0.15)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
                Smart Packages & Collaboration
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal mb-6">
                AI validates npm packages, auto-recovers preview errors, and lets teams review ideas and iterate faster without long feedback loops.
              </p>
            </div>

            {/* Graphic 4: Collaboration Canvas Graphic */}
            <div className="rounded-2xl border border-zinc-800/80 bg-[#07080d]/80 p-4 relative min-h-52.5 flex items-center justify-center overflow-hidden shadow-inner">
              {/* Rotating sync center icon */}
              <div className="h-10 w-10 rounded-full border border-orange-500/50 bg-orange-500/15 text-orange-400 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                <Zap className="h-5 w-5 text-orange-400 animate-pulse" />
              </div>

              {/* Chat bubble 1 */}
              <div className="absolute left-4 bottom-5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-[11px] text-zinc-300 shadow-lg flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> really cool
              </div>

              {/* Chat bubble 2 */}
              <div className="absolute right-4 top-6 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300 shadow-lg flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-400" /> awesome works!
              </div>

              {/* Jessica Cursor */}
              <div className="absolute right-12 bottom-8 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-black shadow-md">
                <MousePointer2 className="h-2.5 w-2.5 fill-black text-black" /> Jessica
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ── HOW IT WORKS SECTION ────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-4 sm:px-6 pb-20 sm:pb-32 max-w-6xl mx-auto relative">
        <div className="flex flex-col items-center text-center mb-10 sm:mb-14">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-px w-5 bg-linear-to-r from-transparent to-orange-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              HOW IT WORKS
            </span>
            <span className="h-px w-5 bg-linear-to-l from-transparent to-orange-500" />
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Build Website In Simple Steps
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
            From idea to structured layout, Zephyre AI helps you move faster without overcomplicating the process.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto items-stretch mb-10 sm:mb-12">
          {STEPS.map((step, i) => {
            const stepIcons = [Sparkles, FileCode, Folder, Zap];
            const StepIcon = stepIcons[i % stepIcons.length];

            return (
              <div
                key={step.number}
                className="relative group rounded-2xl border border-orange-500/40 bg-linear-to-b from-[#14151f]/95 via-[#0e0f17]/95 to-[#090a10]/95 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 backdrop-blur-xl overflow-hidden text-left shadow-[0_10px_40px_rgba(249,115,22,0.14)] hover:border-orange-500/60 hover:shadow-[0_15px_50px_rgba(249,115,22,0.25)] hover:-translate-y-1.5"
              >
                {/* Subtle Grid Dot Background */}
                <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f97316_1px,transparent_1px)] bg-size-[14px_14px]" />

                <div className="relative z-10">
                  {/* Icon Box */}
                  <div className="h-10 w-10 rounded-xl border border-orange-500/50 bg-orange-500/15 text-orange-400 flex items-center justify-center mb-6 transition-all shadow-[0_0_15px_rgba(249,115,22,0.25)] group-hover:scale-105">
                    <StepIcon className="h-4.5 w-4.5 text-orange-400" />
                  </div>

                  {/* Step Label */}
                  <p className="text-[11px] font-semibold text-zinc-500 tracking-wider uppercase mb-1.5">
                    Step {i + 1}
                  </p>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                    {step.label}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Button */}
        <div className="flex justify-center">
          <a
            href="#hero"
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-500 text-white font-extrabold text-xs sm:text-sm px-7 py-3 shadow-[0_0_25px_rgba(249,115,22,0.3)] hover:shadow-[0_0_35px_rgba(249,115,22,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            Learn More
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>


      {/* ── PRICING SECTION ─────────────────────────────────────────────────── */}
      <section id="pricing" className="px-4 sm:px-6 pb-20 sm:pb-32 max-w-6xl mx-auto relative">
        <div className="flex flex-col items-center text-center mb-10 sm:mb-14">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-px w-5 bg-linear-to-r from-transparent to-orange-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              PRICING
            </span>
            <span className="h-px w-5 bg-linear-to-l from-transparent to-orange-500" />
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Simple Pricing for Every Stage
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md leading-relaxed">
            Start for free with daily credits. Upgrade when you&apos;re ready to build more and move faster.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 items-stretch">
          {PRICING_PLANS.map((plan) => {
            const planOrder: Record<string, number> = {
              free: 0,
              standard: 1,
              pro: 2,
            };
            const activePlanKey = isSignedIn
              ? has?.({ plan: "pro" })
                ? "pro"
                : has?.({ plan: "standard" })
                  ? "standard"
                  : "free"
              : null;

            const isActive = isSignedIn && activePlanKey === plan.key;
            const isDowngrade =
              isSignedIn &&
              activePlanKey !== null &&
              !isActive &&
              planOrder[plan.key] < planOrder[activePlanKey];

            const buttonLabel = isDowngrade ? "Downgrade" : (plan.buttonText || "Get Started");

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative group flex flex-col justify-between rounded-3xl border p-6 sm:p-8 transition-all duration-300 overflow-visible backdrop-blur-2xl",
                  plan.featured
                    ? "border-orange-500/40 bg-linear-to-b from-[#14151f]/95 via-[#0e0f17]/95 to-[#090a10]/95 shadow-[0_15px_50px_rgba(249,115,22,0.18)] hover:shadow-[0_25px_60px_rgba(249,115,22,0.28)] hover:border-orange-500/60 md:-translate-y-2 z-10"
                    : "border-white/10 bg-[#090a0f]/90 hover:border-zinc-700/90 hover:bg-[#0d0e16] hover:-translate-y-1.5 shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
                )}
              >
                {/* Top Border Elegant Popular Badge for Pro Plan */}
                {plan.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/50 bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 px-4 py-1 text-[10px] font-extrabold text-white tracking-widest uppercase shadow-[0_0_20px_rgba(249,115,22,0.45)]">
                      Popular Plan
                    </span>
                  </div>
                )}

                <div>
                  {/* Plan Name & Active Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2 pt-1">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{plan.label}</h3>
                    {isActive && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 leading-relaxed mb-6 min-h-9.5">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-xs">
                      ${plan.price}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium tracking-wide">/month</span>
                  </div>

                  {/* Action Button */}
                  <div className="mb-8">
                    {isActive ? (
                      <Button
                        disabled
                        className="w-full h-11 rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed border border-zinc-800 bg-transparent text-zinc-400"
                        variant="ghost"
                      >
                        ✓ Current plan
                      </Button>
                    ) : plan.price === 0 ? (
                      isSignedIn ? (
                        <Button
                          disabled
                          className="w-full h-11 rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed border border-zinc-800 bg-transparent text-zinc-400"
                          variant="ghost"
                        >
                          Default plan
                        </Button>
                      ) : (
                        <SignInButton mode="modal">
                          <Button
                            className="w-full h-11 rounded-xl text-xs font-semibold border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white transition-all cursor-pointer"
                            variant="ghost"
                          >
                            {buttonLabel}
                          </Button>
                        </SignInButton>
                      )
                    ) : isSignedIn ? (
                      <CheckoutButton
                        planId={plan.planId}
                        planPeriod="month"
                        checkoutProps={{
                          appearance: {
                            elements: {
                              drawerRoot: {
                                zIndex: 2000,
                              },
                            },
                          },
                        }}
                      >
                        <Button
                          className={cn(
                            "w-full h-11 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                            plan.featured
                              ? "bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-500 text-white shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:shadow-[0_0_35px_rgba(249,115,22,0.5)] border-0"
                              : "border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white"
                          )}
                          variant="ghost"
                        >
                          {buttonLabel}
                        </Button>
                      </CheckoutButton>
                    ) : (
                      <SignInButton mode="modal">
                        <Button
                          className={cn(
                            "w-full h-11 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                            plan.featured
                              ? "bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-500 text-white shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:shadow-[0_0_35px_rgba(249,115,22,0.5)] border-0"
                              : "border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white"
                          )}
                          variant="ghost"
                        >
                          {buttonLabel}
                        </Button>
                      </SignInButton>
                    )}
                  </div>

                  {/* Feature List Section */}
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-4">Features:</p>
                    <div className="space-y-3">
                      {plan.features.map((f) => (
                        <div key={f} className="flex items-center gap-3 text-xs text-zinc-300 font-medium">
                          <div className={cn(
                            "h-4.5 w-4.5 rounded-full shrink-0 flex items-center justify-center transition-colors",
                            plan.featured
                              ? "border border-orange-500/40 bg-orange-500/15 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                              : "border border-zinc-700/80 bg-zinc-800/80 text-zinc-300"
                          )}>
                            <Check className={cn("h-3 w-3 stroke-[2.5]", plan.featured ? "text-orange-400" : "text-zinc-300")} />
                          </div>
                          <span className="leading-snug">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ SECTION ──────────────────────────────────────────────────────── */}
      <section id="faq" className="relative mx-auto mb-20 sm:mb-32 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start text-left mb-8 sm:mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-px w-5 bg-linear-to-r from-transparent to-orange-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              FAQ
            </span>
            <span className="h-px w-5 bg-linear-to-l from-transparent to-orange-500" />
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Frequently Asked Questions
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
            Everything you need to know before building your website with AI.
          </p>
        </div>

        {/* FAQ Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-start">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                onClick={() => setOpenFaq(isOpen ? null : index)}
                className={cn(
                  "relative rounded-2xl border p-5 sm:p-6 transition-all duration-300 cursor-pointer select-none",
                  isOpen
                    ? "border-orange-500/35 bg-[#0e0f17] shadow-[0_0_35px_rgba(249,115,22,0.1)]"
                    : "border-zinc-800/80 bg-[#090a0f]/90 hover:border-zinc-700/80 hover:bg-[#0c0d14]"
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className={cn(
                    "text-sm sm:text-base font-bold transition-colors leading-snug",
                    isOpen ? "text-white" : "text-zinc-200"
                  )}>
                    {faq.question}
                  </h3>
                  <div className={cn(
                    "h-7 w-7 rounded-lg shrink-0 flex items-center justify-center transition-all",
                    isOpen
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                      : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50"
                  )}>
                    {isOpen ? (
                      <Minus className="h-4 w-4 text-orange-400" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </div>
                </div>

                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed pt-2.5 border-t border-zinc-800/40">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>


      {/* ── CTA SECTION ─────────────────────────────────────────────────────── */}
      <section id="cta" className="relative mx-auto mb-20 sm:mb-32 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-orange-500/25 bg-[#090a0f] p-6 sm:p-10 lg:p-14 shadow-[0_0_80px_rgba(249,115,22,0.15)] backdrop-blur-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-orange-500/15 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/15 blur-[120px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: CTA Content */}
            <div className="lg:col-span-5 flex flex-col items-start text-left">
              {/* Top Badge */}
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="h-px w-6 bg-linear-to-r from-transparent to-orange-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                  JOIN NOW
                </span>
                <span className="h-px w-6 bg-linear-to-l from-transparent to-orange-500" />
              </div>

              {/* Headline */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                Ready to Build Your{" "}
                <span className="bg-linear-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(249,115,22,0.4)]">
                  Next Website?
                </span>
              </h2>

              <p className="mt-4 text-xs sm:text-sm leading-relaxed text-zinc-400 max-w-md">
                Get 10 free generations on sign up. No credit card required. Upgrade when you&apos;re ready to scale your applications.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3.5 w-full sm:w-auto">
                {isSignedIn ? (
                  <Button
                    size="lg"
                    onClick={() => router.push("/workspace")}
                    className="h-12 rounded-xl bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm px-7 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                  >
                    Get Started
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <SignInButton mode="modal">
                    <Button
                      size="lg"
                      className="h-12 rounded-xl bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm px-7 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                    >
                      Get Started
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </SignInButton>
                )}

                <a href="#how-it-works">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium text-sm px-6 transition-all cursor-pointer"
                  >
                    See How It Works
                  </Button>
                </a>
              </div>
            </div>

            {/* Right Column: Code Editor Preview */}
            <div className="lg:col-span-7 relative w-full">
              <div className="relative rounded-2xl border border-zinc-800/90 bg-[#0c0d12] shadow-2xl overflow-hidden font-mono text-xs text-zinc-300">
                {/* Window Header bar */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#0e0f16] px-4 py-2 select-none">
                  <div className="flex items-center gap-3">
                    {/* Traffic light dots */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors" />
                      <div className="h-3 w-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors" />
                      <div className="h-3 w-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors" />
                    </div>

                    {/* Window Toolbar Items */}
                    <div className="hidden sm:flex items-center gap-3 text-zinc-500 text-[11px] ml-2">
                      <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer transition-colors">
                        <Folder className="h-3.5 w-3.5 text-orange-400" /> File
                      </span>
                      <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer transition-colors">
                        <Search className="h-3.5 w-3.5" /> Search
                      </span>
                      <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer transition-colors">
                        <GitBranch className="h-3.5 w-3.5" /> Git
                      </span>
                    </div>
                  </div>

                  {/* Window Status Badge */}
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-400">
                      <GitBranch className="h-3 w-3 text-orange-400" /> main*
                    </span>
                  </div>
                </div>

                {/* Editor Tab Bar */}
                <div className="flex items-center gap-1 border-b border-zinc-800/80 bg-[#0a0b10] px-2 pt-1.5 select-none overflow-x-auto text-[11px]">
                  {/* Inactive Tab 1 */}
                  <div className="px-2.5 py-1.5 rounded-t-md bg-zinc-900/40 border-t border-x border-zinc-800/60 text-zinc-500 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer transition-colors">
                    <File className="h-3 w-3 text-zinc-500" />
                    components.json
                  </div>

                  {/* Active Tab */}
                  <div className="px-3 py-1.5 rounded-t-md bg-[#0c0d12] border-t-2 border-t-orange-500 border-x border-zinc-800/90 text-orange-300 font-medium flex items-center gap-1.5 shadow-sm">
                    <FileCode className="h-3.5 w-3.5 text-orange-400" />
                    App.tsx
                    <X className="h-3 w-3 text-zinc-500 hover:text-zinc-200 ml-1 cursor-pointer transition-colors" />
                  </div>

                  {/* Inactive Tab 2 */}
                  <div className="px-2.5 py-1.5 rounded-t-md bg-zinc-900/40 border-t border-x border-zinc-800/60 text-zinc-500 hidden sm:flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer transition-colors">
                    <FileCode className="h-3 w-3 text-zinc-500" />
                    App.css
                  </div>

                  {/* Add New Tab Button */}
                  <div className="p-1 ml-1 rounded hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Editor Content Area */}
                <div className="flex min-h-65 sm:min-h-75">
                  {/* Sidebar File Tree */}
                  <div className="w-36 sm:w-44 border-r border-zinc-800/80 bg-[#08090d] p-3 text-[11px] text-zinc-400 hidden sm:flex flex-col gap-1 select-none">
                    <div className="flex items-center gap-1.5 text-zinc-500 font-semibold mb-1 uppercase tracking-wider text-[10px]">
                      <Folder className="h-3 w-3 text-orange-400" /> assets
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer">
                      <File className="h-3 w-3 text-zinc-500" /> placeholder.svg
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer">
                      <File className="h-3 w-3 text-zinc-500" /> robots.txt
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-300 font-semibold mt-2 mb-1 uppercase tracking-wider text-[10px]">
                      <Folder className="h-3 w-3 text-orange-400" /> src
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 text-orange-400 font-medium bg-orange-500/10 rounded py-0.5 px-1 border border-orange-500/20">
                      <FileCode className="h-3 w-3 text-orange-400" /> App.tsx
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer">
                      <FileCode className="h-3 w-3 text-zinc-500" /> App.css
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer">
                      <Folder className="h-3 w-3 text-zinc-500" /> components
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer">
                      <Folder className="h-3 w-3 text-zinc-500" /> context
                    </div>
                    <div className="pl-3 flex items-center gap-1.5 hover:text-zinc-300 cursor-pointer">
                      <Folder className="h-3 w-3 text-zinc-500" /> hooks
                    </div>
                  </div>

                  {/* Code Panel */}
                  <div className="flex-1 p-4 bg-[#0a0b10] overflow-x-auto text-[12px] leading-relaxed">
                    <div className="text-[11px] text-zinc-500 mb-3 flex items-center gap-1 select-none">
                      <span>src</span> &gt; <span>App.tsx</span> &gt; <span className="text-orange-400">&lt;&gt; App()</span>
                    </div>

                    <div className="space-y-1 font-mono">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">1</span>
                        <span className="text-zinc-500">// App.tsx</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">2</span>
                        <span>
                          <span className="text-amber-400">import</span> React <span className="text-amber-400">from</span> <span className="text-emerald-400">&quot;react&quot;</span>;
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">3</span>
                        <span>
                          <span className="text-amber-400">import</span> <span className="text-emerald-400">&quot;./App.css&quot;</span>;
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">4</span>
                        <span>
                          <span className="text-amber-400">function</span> <span className="text-orange-300">App</span>() &#123;
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">5</span>
                        <span className="pl-4">
                          <span className="text-amber-400">return</span> (
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">6</span>
                        <span className="pl-8 text-zinc-400">
                          &lt;<span className="text-orange-400">ZephyreWebsiteBuilder</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">7</span>
                        <span className="pl-12">
                          <span className="text-purple-300">theme</span>=<span className="text-emerald-400">&quot;orange-vibrant&quot;</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">8</span>
                        <span className="pl-12">
                          <span className="text-purple-300">aiModel</span>=<span className="text-emerald-400">&quot;nextjs-16-fullstack&quot;</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">9</span>
                        <span className="pl-8 text-zinc-400">/&gt;</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">10</span>
                        <span className="pl-4">);</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">11</span>
                        <span>&#125;</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-right text-zinc-600 select-none">12</span>
                        <span>
                          <span className="text-amber-400">export default</span> App;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/80 bg-[#050608]/90 pt-16 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Left Column: Brand & Social Icons */}
            <div className="md:col-span-5 flex flex-col items-start">
              <Link href="/" className="flex items-center gap-3 group">
                <Image
                  src="/logo.svg"
                  alt="Zephyre"
                  width={36}
                  height={18}
                  className="h-6 w-auto object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                />
                <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-orange-400 transition-colors">
                  Zephyre
                </span>
              </Link>

              <p className="mt-3 text-xs text-zinc-400 max-w-sm leading-relaxed">
                Empowering creators to design, build, and deploy production-ready web apps with next-gen AI.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-3 mt-6">
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all flex items-center justify-center"
                  aria-label="LinkedIn"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.63a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all flex items-center justify-center"
                  aria-label="Instagram"
                >
                  <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all flex items-center justify-center"
                  aria-label="X"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all flex items-center justify-center"
                  aria-label="GitHub"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Right Columns: Nav Links */}
            <div className="md:col-span-7 grid grid-cols-3 gap-6 sm:gap-8">
              {/* Product */}
              <div>
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-4">
                  Product
                </h3>
                <ul className="space-y-2.5 text-xs text-zinc-400 font-medium">
                  <li>
                    <a href="#features" className="hover:text-white transition-colors">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="hover:text-white transition-colors">
                      How It Works
                    </a>
                  </li>
                  <li>
                    <a href="#templates" className="hover:text-white transition-colors">
                      Templates
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="hover:text-white transition-colors">
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#changelog" className="hover:text-white transition-colors">
                      Changelog
                    </a>
                  </li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-4">
                  Resources
                </h3>
                <ul className="space-y-2.5 text-xs text-zinc-400 font-medium">
                  <li>
                    <a href="#docs" className="hover:text-white transition-colors">
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a href="#tutorials" className="hover:text-white transition-colors">
                      Tutorials
                    </a>
                  </li>
                  <li>
                    <a href="#blog" className="hover:text-white transition-colors">
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#community" className="hover:text-white transition-colors">
                      Community
                    </a>
                  </li>
                  <li>
                    <a href="#support" className="hover:text-white transition-colors">
                      Support
                    </a>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-4">
                  Company
                </h3>
                <ul className="space-y-2.5 text-xs text-zinc-400 font-medium">
                  <li>
                    <a href="#about" className="hover:text-white transition-colors">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#careers" className="hover:text-white transition-colors">
                      Careers
                    </a>
                  </li>
                  <li>
                    <a href="#contact" className="hover:text-white transition-colors">
                      Contact
                    </a>
                  </li>
                  <li>
                    <a href="#press" className="hover:text-white transition-colors">
                      Press
                    </a>
                  </li>
                  <li>
                    <a href="#terms" className="hover:text-white transition-colors">
                      Terms {"&"} Privacy
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-zinc-800/80 pt-8 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <p>© 2026 Zephyre AI. All rights reserved. Made with ❤️ by Alok Hotta</p>

            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All System Operational</span>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
