"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowRight, Zap, ChevronRight, Check, Sparkles, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HoleBackground } from "@/components/animate-ui/components/backgrounds/hole";
import { Badge } from "@/components/ui/badge";
import { BlueTitle, GrayTitle, SectionHeading, SectionLabel } from "@/components/reusables";
import { FEATURES, PLACEHOLDERS, STEPS, SUGGESTIONS } from "@/lib/data";
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
    <main className='min-h-screen bg-[#07080c] text-white selection:bg-purple-500/30 selection:text-purple-200'>

      {/* HERO SECTION - DESIGNER OPTIMIZED DARK RELUME LANDING PAGE */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center">
        
        {/* Canvas Outer Frame Box */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative w-full rounded-2xl border border-white/8 bg-[#08090e]/90 backdrop-blur-md p-6 sm:p-12 lg:p-16 flex flex-col items-center text-center overflow-hidden shadow-[0_20px_80px_-15px_rgba(0,0,0,0.9)] min-h-165 justify-center transition-all group"
        >
          {/* Ambient Radial Spotlight Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-600/15 blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-125 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

          <HoleBackground
            strokeColor="rgba(168,85,247,0.14)"
            particleRGBColor={[168, 85, 247]}
            numberOfLines={40}
            numberOfDiscs={40}
            className="absolute inset-0 h-full w-full opacity-50 pointer-events-none"
            style={{
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)",
            }}
          />

          {/* Canvas Corner Node Handles */}
          <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-xs bg-purple-500 border border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.8)] z-20" />
          <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-xs bg-purple-500 border border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.8)] z-20" />

          {/* Canvas Left Border Shuffle Pill */}
          <button
            onClick={handleShuffleCards}
            className="absolute bottom-3.5 left-4 sm:left-6 z-30 bg-[#141520]/90 hover:bg-[#1f2130] border border-purple-500/30 hover:border-purple-500/60 text-purple-300 text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-black/50 active:scale-95 transition-all cursor-pointer backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            Shuffle
          </button>

          {/* Trust Pill Badge */}
          <div className="z-10 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/4 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-zinc-300 shadow-sm mb-6">
            <span className="bg-linear-to-r from-amber-400 via-rose-400 to-pink-400 bg-clip-text text-transparent font-bold">
              1 Million+
            </span>{" "}
            Designers & Developers trust Relume
          </div>

          {/* Main Hero Headline */}
          <h1 className="z-10 mx-auto max-w-4xl text-balance font-sans text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] drop-shadow-sm">
            Websites designed &
            <br />
            built faster with AI
          </h1>

          {/* Subtitle */}
          <p className="z-10 mx-auto mt-5 max-w-2xl text-balance text-sm sm:text-base leading-relaxed text-zinc-400 font-normal relative">
            Use AI as your design ally, not a replacement. Instantly generate Sitemaps, Wireframes and Style Guides for marketing websites—all in minutes

            {/* Guest Green Cursor Badge */}
            <span
              style={{
                transform: `translate(${mouseOffset.x * 22}px, ${mouseOffset.y * 14}px)`,
              }}
              className="hidden sm:flex absolute -right-6 -bottom-6 z-30 items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-lg shadow-emerald-500/30 border border-emerald-400 transition-transform duration-300 ease-out"
            >
              <MousePointer2 className="h-3 w-3 fill-white text-white" />
              Guest
            </span>
          </p>

          {/* ── FLOATING MOCKUP CARDS & CURSORS (LEFT SIDE) ────────────────── */}

          {/* Card 1: Top Left - hero-1.webp */}
          <div
            style={{
              transform: `translate(${mouseOffset.x * -18}px, ${mouseOffset.y * -14}px) rotate(${isShuffled ? 4 : -3}deg)`,
            }}
            className="hidden lg:block absolute left-4 top-8 z-10 w-56 rounded-xl border border-white/12 bg-[#161219]/90 p-1.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:z-30 hover:border-rose-500/60 hover:shadow-[0_20px_50px_rgba(244,63,94,0.2)]"
          >
            <div className="flex items-center gap-1 px-1.5 py-1 mb-1 border-b border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Image
                src="/hero-section/hero-1.webp"
                alt="Astrology & Mysticism Website Preview"
                width={280}
                height={180}
                className="w-full h-auto object-cover brightness-95 contrast-105"
              />
            </div>
          </div>

          <div
            style={{
              transform: `translate(${mouseOffset.x * -24}px, ${mouseOffset.y * -18}px) rotate(${isShuffled ? -3 : 1}deg)`,
            }}
            className="hidden lg:block absolute left-2 top-48 z-10 w-60 rounded-xl border border-white/12 bg-[#12131a]/95 p-1.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:z-30 hover:border-zinc-400 hover:shadow-[0_20px_50px_rgba(255,255,255,0.08)]"
          >
            <div className="flex items-center gap-1 px-1.5 py-1 mb-1 border-b border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Image
                src="/hero-section/hero-2.png"
                alt="Accelerate Adoption Website Preview"
                width={280}
                height={180}
                className="w-full h-auto object-cover brightness-95 contrast-105"
              />
            </div>
          </div>

          <div
            style={{
              transform: `translate(${mouseOffset.x * -12}px, ${mouseOffset.y * -20}px) rotate(${isShuffled ? 2 : -2}deg)`,
            }}
            className="hidden lg:block absolute left-6 bottom-20 z-10 w-64 rounded-xl border border-white/12 bg-[#090a0e]/95 p-1.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] transition-all duration-300 hover:scale-105 hover:z-30 hover:border-amber-500/60 hover:shadow-[0_20px_50px_rgba(251,191,36,0.15)]"
          >
            <div className="flex items-center gap-1 px-1.5 py-1 mb-1 border-b border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/20" />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Image
                src="/hero-section/hero-3.png"
                alt="Creative Marketing Agency Website Preview"
                width={280}
                height={180}
                className="w-full h-auto object-cover brightness-95 contrast-105"
              />
            </div>

            {/* Jessica Yellow Cursor Badge */}
            <div
              style={{
                transform: `translate(${mouseOffset.x * -8}px, ${mouseOffset.y * -8}px)`,
              }}
              className="absolute -right-3 -top-3 z-30 flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-black shadow-lg shadow-amber-400/30 border border-amber-300 transition-transform duration-300 ease-out"
            >
              <MousePointer2 className="h-3 w-3 fill-black text-black" />
              Jessica
            </div>
          </div>

          {/* ── FLOATING MOCKUP CARDS & CURSORS (RIGHT SIDE) ────────────────── */}

          {/* Card 4: Top Right - hero-4.webp */}
          <div
            style={{
              transform: `translate(${mouseOffset.x * 18}px, ${mouseOffset.y * -14}px) rotate(${isShuffled ? -4 : 3}deg)`,
            }}
            className="hidden lg:block absolute right-4 top-8 z-10 w-60 rounded-xl border border-white/12 bg-[#0b1728]/90 p-1.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:z-30 hover:border-sky-500/60 hover:shadow-[0_20px_50px_rgba(14,165,233,0.2)]"
          >
            <div className="flex items-center gap-1 px-1.5 py-1 mb-1 border-b border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500/20" />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Image
                src="/hero-section/hero-4.webp"
                alt="The World is Yours Travel Preview"
                width={280}
                height={180}
                className="w-full h-auto object-cover brightness-95 contrast-105"
              />
            </div>
          </div>

          {/* Card 5: Middle Right - hero-5.webp + Mario Cursor */}
          <div
            style={{
              transform: `translate(${mouseOffset.x * 24}px, ${mouseOffset.y * -18}px) rotate(${isShuffled ? 3 : -2}deg)`,
            }}
            className="hidden lg:block absolute right-2 top-48 z-10 w-60 rounded-xl border border-white/12 bg-[#0c1c16]/90 p-1.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:z-30 hover:border-emerald-500/60 hover:shadow-[0_20px_50px_rgba(16,185,129,0.2)]"
          >
            {/* Mario Blue Cursor Badge */}
            <div
              style={{
                transform: `translate(${mouseOffset.x * 10}px, ${mouseOffset.y * -10}px)`,
              }}
              className="absolute -left-4 -top-3 z-30 flex items-center gap-1 rounded-full bg-blue-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-lg shadow-blue-500/30 border border-blue-400 transition-transform duration-300 ease-out"
            >
              <MousePointer2 className="h-3 w-3 fill-white text-white" />
              Mario
            </div>

            <div className="flex items-center gap-1 px-1.5 py-1 mb-1 border-b border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/20" />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Image
                src="/hero-section/hero-5.webp"
                alt="Help Leaders Grow Website Preview"
                width={280}
                height={180}
                className="w-full h-auto object-cover brightness-95 contrast-105"
              />
            </div>
          </div>

          {/* Card 6: Bottom Right - hero-6.webp */}
          <div
            style={{
              transform: `translate(${mouseOffset.x * 14}px, ${mouseOffset.y * -20}px) rotate(${isShuffled ? -2 : 2}deg)`,
            }}
            className="hidden lg:block absolute right-6 bottom-20 z-10 w-64 rounded-xl border border-white/12 bg-[#12131b]/95 p-1.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.9)] transition-all duration-300 hover:scale-105 hover:z-30 hover:border-indigo-500/60 hover:shadow-[0_20px_50px_rgba(99,102,241,0.2)]"
          >
            <div className="flex items-center gap-1 px-1.5 py-1 mb-1 border-b border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500/20" />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Image
                src="/hero-section/hero-6.webp"
                alt="Drive Smarter Decisions Preview"
                width={280}
                height={180}
                className="w-full h-auto object-cover brightness-95 contrast-105"
              />
            </div>
          </div>

          {/* ── AI WEBSITE GENERATOR INPUT PROMPT CONTAINER ────────────────── */}
          <div className="z-20 mt-10 w-full max-w-2xl relative">
            
            {/* Glowing Gradient Border Wrapper */}
            <div className="p-[2.5px] rounded-2xl bg-linear-to-r from-amber-500/80 via-purple-500/80 to-indigo-500/80 shadow-[0_0_40px_rgba(147,51,234,0.3)] hover:shadow-[0_0_60px_rgba(147,51,234,0.45)] transition-all duration-300">
              
              <div className="rounded-[13px] bg-[#0c0d14]/95 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-3">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Describe a company in a sentence or two..."
                  rows={1}
                  className="w-full resize-none bg-transparent px-2 text-sm placeholder:text-zinc-500 text-white focus:outline-none sm:text-base"
                  style={{ minHeight: 48, maxHeight: 180 }}
                />

                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs text-zinc-500 hidden sm:inline">
                    Press ⏎ to generate · Shift+⏎ for new line
                  </span>

                  {isSignedIn ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={!prompt.trim()}
                      className="ml-auto h-10 rounded-xl px-6 font-semibold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 hover:brightness-110 text-white shadow-lg shadow-purple-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </Button>
                  ) : (
                    <SignInButton mode="modal">
                      <Button className="ml-auto h-10 rounded-xl px-6 font-semibold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 hover:brightness-110 text-white shadow-lg shadow-purple-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Sparkles className="h-4 w-4" />
                        Generate
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            </div>

            {/* Suggestion Chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-full border border-white/8 bg-white/4 px-3.5 py-1.5 text-xs text-zinc-400 hover:border-purple-500/40 hover:bg-white/8 hover:text-white transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs text-zinc-500 z-10">
            No credit card required · 10 free generations on sign up
          </p>

        </div>
      </section>

      {/* ── 3 FEATURE CARDS SECTION (SITEMAPS, WIREFRAMES, STYLE GUIDE) ───────── */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="z-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto text-left">
          
          {/* CARD 1: SITEMAPS */}
          <div
            onMouseEnter={() => setHoveredFeatureCard('sitemaps')}
            onMouseLeave={() => setHoveredFeatureCard(null)}
            className={cn(
              "relative rounded-2xl border border-white/10 bg-[#0a0b13]/90 backdrop-blur-xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 group/card cursor-pointer min-h-95",
              hoveredFeatureCard === 'sitemaps' ? "border-purple-500/60 shadow-[0_15px_40px_rgba(168,85,247,0.2)] -translate-y-1.5" : "hover:border-white/20"
            )}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider bg-linear-to-r from-rose-400 to-purple-400 bg-clip-text text-transparent mb-1">
                Plan
              </p>
              <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                Sitemaps
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400 font-normal mb-5">
                Quickly map out your website pages with an AI-generated sitemap
              </p>

              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-white border border-white/15 bg-white/5 hover:bg-white/10 rounded-lg px-3.5 py-1.5 transition-all mb-6">
                Give it a try
              </button>
            </div>

            {/* Sitemap Mockup Graphic */}
            <div className="relative mt-auto w-full rounded-xl border border-white/10 bg-[#12131d]/90 p-3 flex flex-col gap-2 overflow-hidden shadow-inner">
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/80 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-400" /> Home
                </span>
                <span className="text-zinc-400 text-[10px]">•••</span>
              </div>

              <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-purple-500/40">
                <div className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200">
                  Navbar
                </div>
                <div className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300">
                  Hero Header Section
                </div>
                
                {/* Interactive Highlighted Node on Hover */}
                <div className={cn(
                  "relative rounded-md border p-2.5 text-[11px] font-semibold transition-all duration-300",
                  hoveredFeatureCard === 'sitemaps' ? "border-purple-400 bg-purple-950/50 text-purple-200 shadow-md shadow-purple-500/20" : "border-zinc-700 bg-zinc-800/50 text-zinc-300"
                )}>
                  Feature Section
                  <p className="text-[9px] text-zinc-400 font-normal">Describe main feature</p>

                  {/* Guest & Jessica Cursors hovering on sitemap node */}
                  <span className={cn(
                    "absolute -right-2 -bottom-2.5 z-20 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-md transition-all duration-300",
                    hoveredFeatureCard === 'sitemaps' ? "scale-110 translate-x-1" : "scale-90"
                  )}>
                    <MousePointer2 className="h-2.5 w-2.5 fill-white text-white" /> Guest
                  </span>
                  <span className={cn(
                    "absolute -right-12 bottom-2 z-20 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-black shadow-md transition-all duration-300",
                    hoveredFeatureCard === 'sitemaps' ? "scale-110 -translate-y-1" : "scale-90"
                  )}>
                    <MousePointer2 className="h-2.5 w-2.5 fill-black text-black" /> Jessica
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: WIREFRAMES */}
          <div
            onMouseEnter={() => setHoveredFeatureCard('wireframes')}
            onMouseLeave={() => setHoveredFeatureCard(null)}
            className={cn(
              "relative rounded-2xl border border-white/10 bg-[#0a0b13]/90 backdrop-blur-xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 group/card cursor-pointer min-h-95",
              hoveredFeatureCard === 'wireframes' ? "border-blue-500/60 shadow-[0_15px_40px_rgba(59,130,246,0.2)] -translate-y-1.5" : "hover:border-white/20"
            )}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-1">
                Structure
              </p>
              <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                Wireframes
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400 font-normal mb-5">
                Effortlessly structure your pages and copy with distraction-free wireframes
              </p>

              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-white border border-white/15 bg-white/5 hover:bg-white/10 rounded-lg px-3.5 py-1.5 transition-all mb-6">
                Give it a try
              </button>
            </div>

            {/* Wireframes Mockup Graphic */}
            <div className="relative mt-auto w-full rounded-xl border border-white/10 bg-[#0e101a]/90 p-3.5 flex flex-col gap-2.5 overflow-hidden shadow-inner min-h-35 justify-between">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-white tracking-wide">Logo</span>
                <div className="flex gap-2 text-[10px] text-zinc-400">
                  <span>Features</span>
                  <span>Pricing</span>
                </div>
              </div>

              <div className={cn(
                "flex flex-col gap-1.5 p-2 rounded-lg transition-all duration-300",
                hoveredFeatureCard === 'wireframes' ? "bg-blue-950/30 border border-blue-500/30" : ""
              )}>
                <p className="text-xs font-extrabold text-white leading-tight">
                  Inspire Culture, Connect through art
                </p>
                <div className="h-2 w-3/4 rounded bg-zinc-700/60" />
                <div className="h-2 w-1/2 rounded bg-zinc-800" />
                <div className="mt-1 h-5 w-16 rounded bg-white text-black font-bold text-[9px] flex items-center justify-center">
                  Button
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: STYLE GUIDE */}
          <div
            onMouseEnter={() => setHoveredFeatureCard('styleguide')}
            onMouseLeave={() => setHoveredFeatureCard(null)}
            className={cn(
              "relative rounded-2xl border border-white/10 bg-[#0a0b13]/90 backdrop-blur-xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 group/card cursor-pointer min-h-95",
              hoveredFeatureCard === 'styleguide' ? "border-rose-500/60 shadow-[0_15px_40px_rgba(244,63,94,0.2)] -translate-y-1.5" : "hover:border-white/20"
            )}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider bg-linear-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent mb-1">
                Conceptualise
              </p>
              <h3 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                Style Guide
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400 font-normal mb-5">
                Instantly create design concepts and apply the winning style across pages
              </p>

              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-white border border-white/15 bg-white/5 hover:bg-white/10 rounded-lg px-3.5 py-1.5 transition-all mb-6">
                Give it a try
              </button>
            </div>

            {/* Style Guide Mockup Graphic + Color Swatches Side Bar */}
            <div className="relative mt-auto w-full rounded-xl border border-white/10 bg-linear-to-br from-purple-900/60 via-indigo-900/50 to-pink-900/60 p-3.5 flex items-center justify-between overflow-hidden shadow-inner min-h-35">
              <div className="flex flex-col gap-1.5 max-w-[70%]">
                <span className="text-xs font-black text-white leading-tight">
                  Culture, stories through art
                </span>
                <span className="text-[10px] text-purple-200/70">
                  Apply winning style across pages
                </span>
                <div className="h-4 w-14 rounded bg-purple-500 text-white font-bold text-[8px] flex items-center justify-center">
                  Learn More
                </div>
              </div>

              {/* Color Swatches Bar on the Right */}
              <div className={cn(
                "flex flex-col gap-1 p-1 rounded-lg bg-black/60 border border-white/10 transition-transform duration-300",
                hoveredFeatureCard === 'styleguide' ? "translate-x-0 scale-105" : "translate-x-1"
              )}>
                <div className="h-4 w-4 rounded-sm bg-rose-400" />
                <div className="h-4 w-4 rounded-sm bg-pink-400" />
                <div className="h-4 w-4 rounded-sm bg-amber-400" />
                <div className="h-4 w-4 rounded-sm bg-emerald-400" />
                <div className="h-4 w-4 rounded-sm bg-purple-500" />
              </div>

              {/* Cursors Jackson & Guest */}
              <span className={cn(
                "absolute left-3 bottom-2 z-20 flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-md transition-all duration-300",
                hoveredFeatureCard === 'styleguide' ? "scale-110 -translate-y-1" : "scale-90"
              )}>
                <MousePointer2 className="h-2.5 w-2.5 fill-white text-white" /> Jackson
              </span>
              <span className={cn(
                "absolute right-12 top-2 z-20 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-md transition-all duration-300",
                hoveredFeatureCard === 'styleguide' ? "scale-110 translate-y-1" : "scale-90"
              )}>
                <MousePointer2 className="h-2.5 w-2.5 fill-white text-white" /> Guest
              </span>
            </div>
          </div>

        </div>
      </section>





      {/* ── BROWSER MOCKUP WORKSPACE PREVIEW ─────────────────────────────────── */}
      <section className="px-4 pb-32 max-w-7xl mx-auto">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/12 bg-[#090a13]/95 shadow-[0_25px_80px_-15px_rgba(147,51,234,0.3)] backdrop-blur-xl transition-all hover:border-purple-500/40">
          
          {/* Top Browser Control Bar */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c0d16] px-4 py-3">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500/80 shadow-xs shadow-rose-500/50" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80 shadow-xs shadow-amber-500/50" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-xs shadow-emerald-500/50" />
            </div>

            <div className="mx-auto flex h-7 w-72 items-center justify-center rounded-lg border border-white/10 bg-white/4 px-3 shadow-inner">
              <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                zephyre.app/workspace
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row h-115">
            {/* Left Chat Panel */}
            <div className="flex w-full md:w-80 flex-col border-r border-white/10 bg-[#0b0c16]">
              <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider font-bold text-purple-400">
                  AI Workspace Chat
                </p>
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
              </div>

              <div className="flex-1 space-y-4 px-4 py-4 overflow-y-auto">
                <div className="flex justify-end">
                  <div className="max-w-55 rounded-2xl rounded-br-sm border border-purple-500/40 bg-linear-to-r from-purple-600/30 to-indigo-600/30 px-3.5 py-2.5 shadow-md shadow-purple-900/20">
                    <p className="text-xs text-purple-100 font-medium">
                      Build a kanban board with 3 columns and drag-and-drop
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-500/30">
                    <Zap className="h-3.5 w-3.5 fill-white text-white" />
                  </div>

                  <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/4 px-3.5 py-2.5 backdrop-blur-sm">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      I&apos;ll build a Kanban board with Todo, In Progress, and
                      Done columns. I&apos;ll use{" "}
                      <code className="text-purple-300 font-mono bg-purple-950/60 border border-purple-500/30 rounded px-1 py-0.5">@dnd-kit/core</code>{" "}
                      for smooth drag-and-drop…
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 text-white">
                    <Zap className="h-3.5 w-3.5 fill-white text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-white/4 px-3.5 py-3">
                    {[0, 0.15, 0.3].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 px-3 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 shadow-inner">
                  <span className="flex-1 text-xs text-zinc-500 font-medium">
                    Ask AI to modify design…
                  </span>
                  <div className="h-6 w-6 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Workspace Preview Grid */}
            <div className="flex flex-1 flex-col bg-[#0e0f1c]">
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c0d16] px-4">
                <button className="border-b-2 border-purple-500 px-4 py-2.5 text-xs font-bold text-white bg-purple-500/10">
                  Live Preview
                </button>
                <button className="px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
                  Code Editor
                </button>
              </div>

              <div className="flex flex-1 gap-3.5 overflow-hidden p-5">
                {[
                  { name: "Todo", count: 3, badge: "bg-amber-500/20 text-amber-300 border-amber-500/40", bar: "bg-amber-400" },
                  { name: "In Progress", count: 2, badge: "bg-purple-500/20 text-purple-300 border-purple-500/40", bar: "bg-purple-400" },
                  { name: "Done", count: 1, badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", bar: "bg-emerald-400" },
                ].map((col) => (
                  <div key={col.name} className="flex w-1/3 flex-col gap-2.5 rounded-xl border border-white/8 bg-[#121320]/80 p-3 shadow-inner">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider font-extrabold text-white">
                        {col.name}
                      </span>

                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", col.badge)}>
                        {col.count}
                      </span>
                    </div>

                    {Array.from({ length: col.count }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-white/10 bg-[#171828] p-3 shadow-md hover:border-purple-500/40 transition-all"
                      >
                        <div
                          className={cn("mb-2 h-2 rounded-full", col.bar)}
                          style={{ width: `${65 + i * 12}%` }}
                        />
                        <div className="h-1.5 w-3/4 rounded-full bg-zinc-600/50" />
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
      <section className="px-4 pb-32 max-w-7xl mx-auto">
        <div className="mx-auto mb-14 max-w-5xl text-center">
          <SectionLabel>Everything you need</SectionLabel>
          <SectionHeading gray="From prompt" blue="to production." />
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="group rounded-2xl border border-white/10 bg-[#0a0b14]/90 p-7 shadow-xl backdrop-blur-xl hover:border-purple-500/50 hover:shadow-[0_15px_35px_rgba(168,85,247,0.15)] transition-all duration-300"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/30 bg-linear-to-br from-purple-500/20 via-indigo-500/20 to-pink-500/20 text-purple-300 shadow-md group-hover:scale-110 group-hover:border-purple-400 transition-all">
                <Icon className="h-5 w-5 text-purple-300 group-hover:text-white" />
              </div>
              <p className="mb-2 text-base font-extrabold text-white tracking-tight">{label}</p>
              <p className="text-xs leading-relaxed text-zinc-400 font-normal">{desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── HOW IT WORKS SECTION ────────────────────────────────────────────── */}
      <section className="px-4 pb-32 max-w-7xl mx-auto">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <SectionLabel>How it works</SectionLabel>
          <SectionHeading gray="Four steps" blue="to a working app." />
        </div>

        <div className="mx-auto max-w-3xl">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-purple-500/40 bg-linear-to-br from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-500/25">
                  <span className="font-mono text-xs font-bold text-white">
                    {step.number}
                  </span>
                </div>

                {i < STEPS.length - 1 && (
                  <div className="mt-2 h-full w-0.5 bg-linear-to-b from-purple-500/60 via-indigo-500/30 to-transparent" />
                )}
              </div>

              <div className="pb-10 pt-1.5">
                <p className="mb-1.5 text-base font-extrabold text-white sm:text-lg tracking-tight">
                  {step.label}
                </p>

                <p className="text-xs sm:text-sm leading-relaxed text-zinc-400 font-normal">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* ── PRICING SECTION ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-32 max-w-7xl mx-auto">
        <div className="mx-auto mb-14 max-w-5xl text-center">
          <SectionLabel>Simple pricing</SectionLabel>
          <SectionHeading gray="Start free," blue="scale when ready." />

          <p className="mx-auto mt-4 max-w-sm text-sm text-zinc-400 font-normal">
            No credit card required. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3 items-stretch">
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

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-7 transition-all backdrop-blur-xl shadow-xl",
                  plan.featured
                    ? "border-purple-500/60 bg-linear-to-b from-purple-950/40 via-[#0d0e1b]/95 to-indigo-950/40 shadow-[0_20px_60px_rgba(168,85,247,0.25)] scale-[1.02] z-10"
                    : "border-white/10 bg-[#0a0b14]/90 hover:border-purple-500/30"
                )}
              >
                {/* Most popular pill */}
                {plan.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-linear-to-r from-purple-500 via-rose-500 to-pink-500 px-4 py-1 text-[11px] font-extrabold text-white shadow-lg shadow-purple-500/40 tracking-wide uppercase">
                      Most popular
                    </span>
                  </div>
                )}

                {/* Plan name + active badge */}
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-base font-extrabold text-white">
                    {plan.label}
                  </p>
                  {isActive && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      Active
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="mb-6 text-xs leading-relaxed text-zinc-400 font-normal">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {plan.price === 0 ? "$0" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-xs text-zinc-400 font-medium">/mo</span>
                  )}
                </div>
                <p className="mb-6 text-xs text-zinc-500 font-medium">
                  {plan.price === 0 ? "Always free" : "Only billed monthly"}
                </p>

                {/* Feature list */}
                <div className="mb-8 space-y-3 border-t border-white/10 pt-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      </div>
                      <span className="text-xs text-zinc-300 font-medium">{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA button */}
                <div className="mt-auto">
                  {isActive ? (
                    <Button
                      disabled
                      className="w-full rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed border border-white/10 bg-transparent text-zinc-400"
                      variant="ghost"
                    >
                      ✓ Current plan
                    </Button>
                  ) : plan.price === 0 ? (
                    isSignedIn ? (
                      <Button
                        disabled
                        className="w-full rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed border border-white/10 bg-transparent text-zinc-400"
                        variant="ghost"
                      >
                        Default plan
                      </Button>
                    ) : (
                      <SignInButton mode="modal">
                        <Button
                          className="w-full rounded-xl text-xs font-semibold border border-white/15 bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-all"
                          variant="ghost"
                        >
                          Get started free
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
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
                          "w-full rounded-xl text-xs font-semibold transition-all cursor-pointer",
                          plan.featured
                            ? "bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 hover:brightness-110 text-white shadow-lg shadow-purple-500/30"
                            : "border border-white/15 bg-white/5 hover:bg-white/10 text-white"
                        )}
                        variant="ghost"
                      >
                        {isDowngrade ? "Downgrade" : "Get started"}
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </CheckoutButton>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        className={cn(
                          "w-full rounded-xl text-xs font-semibold transition-all cursor-pointer",
                          plan.featured
                            ? "bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 hover:brightness-110 text-white shadow-lg shadow-purple-500/30"
                            : "border border-white/15 bg-white/5 hover:bg-white/10 text-white"
                        )}
                        variant="ghost"
                      >
                        Get started
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* ── CTA SECTION ─────────────────────────────────────────────────────── */}
      <section className="relative mx-auto mb-32 max-w-5xl overflow-hidden rounded-2xl border border-purple-500/30 bg-[#090a13]/90 px-10 py-24 text-center shadow-[0_20px_80px_rgba(147,51,234,0.3)] backdrop-blur-xl">
        <HoleBackground
          strokeColor="rgba(168,85,247,0.15)"
          numberOfLines={36}
          numberOfDiscs={36}
          particleRGBColor={[168, 85, 247]}
          className="absolute inset-0 h-full w-full opacity-60"
          style={{
            maskImage:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
          }}
        />

        <SectionHeading gray="Start building," blue="for free." />

        <p className="mb-8 text-xs sm:text-sm leading-relaxed text-zinc-400 font-normal relative z-10 max-w-md mx-auto">
          Get 10 free generations on sign up. No credit card required.
          <br />
          Upgrade when you&apos;re ready.
        </p>

        <SignInButton mode="modal">
          <Button
            size="lg"
            className="relative z-10 h-12 rounded-xl bg-linear-to-r from-indigo-500 via-purple-600 to-pink-600 hover:brightness-110 text-white font-bold text-sm px-8 shadow-xl shadow-purple-500/30 hover:scale-105 transition-all cursor-pointer"
          >
            Get started free
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </SignInButton>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 py-12 mx-auto px-6 flex flex-wrap items-center justify-center text-zinc-400 text-xs font-medium">
        Made with ❤️ by Alok Hotta
      </footer>

    </main>
  );
}
