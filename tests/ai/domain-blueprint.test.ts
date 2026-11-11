import { describe, it, expect } from "vitest";
import { synthesizeDomainBlueprint } from "@/lib/ai-prompts";

describe("Domain Knowledge & Feature Expansion Engine", () => {
    it("should classify focused games as single-page with rich micro-features", () => {
        const bp = synthesizeDomainBlueprint("Build a modern Tic-Tac-Toe game with sleek neon glow");
        expect(bp).toContain("FOCUSED DELIGHT UTILITY / GAME");
        expect(bp).toContain("Strictly single-page");
        expect(bp).toContain("Web Audio API synthesized audio");
        expect(bp).toContain("Minimax Unbeatable algorithm");
        expect(bp).toContain("Confetti Particle Celebration");
    });

    it("should synthesize tier-1 streaming platform blueprint for media prompts", () => {
        const bp = synthesizeDomainBlueprint("Create a streaming movie app like Netflix with recommendations");
        expect(bp).toContain("TIER-1 STREAMING PLATFORM");
        expect(bp).toContain("Cinematic Spotlight Hero Banner");
        expect(bp).toContain("Video Player Modal");
        expect(bp).toContain("AI CineMind / Mood-Based Recommender");
        expect(bp).toContain("My List");
    });

    it("should synthesize luxury digital commerce blueprint for shop prompts", () => {
        const bp = synthesizeDomainBlueprint("Build an e-commerce clothing store with cart and checkout");
        expect(bp).toContain("LUXURY DIGITAL COMMERCE & MARKETPLACE");
        expect(bp).toContain("Multi-Faceted Filter & Sort");
        expect(bp).toContain("Slide-Out Cart Drawer");
        expect(bp).toContain("Multi-Step Checkout Modal");
        expect(bp).toContain("Wishlist");
    });

    it("should synthesize modern wealth management blueprint for fintech / crypto prompts", () => {
        const bp = synthesizeDomainBlueprint("A modern crypto trading portfolio and personal finance tracker");
        expect(bp).toContain("MODERN WEALTH & ASSET MANAGEMENT");
        expect(bp).toContain("Portfolio Performance Chart");
        expect(bp).toContain("Send Funds");
        expect(bp).toContain("Transaction Ledger");
        expect(bp).toContain("Crypto & Market Watch Table");
    });

    it("should synthesize high-velocity workspace blueprint for SaaS / Kanban prompts", () => {
        const bp = synthesizeDomainBlueprint("Build a Linear clone for agile task and issue management");
        expect(bp).toContain("HIGH-VELOCITY WORKSPACE");
        expect(bp).toContain("Interactive Kanban Board");
        expect(bp).toContain("Sprint Velocity");
        expect(bp).toContain("Deep Issue Detail Modal");
    });

    it("should synthesize precision meteorological blueprint for weather prompts", () => {
        const bp = synthesizeDomainBlueprint("A weather app with 3D animated radar and atmospheric metrics");
        expect(bp).toContain("PRECISION METEOROLOGICAL RADAR");
        expect(bp).toContain("Radar Visualizer");
        expect(bp).toContain("24-Hour Hourly Forecast");
        expect(bp).toContain("Atmospheric Metrics");
    });

    it("should fall back to universal luxury product standard for general prompts", () => {
        const bp = synthesizeDomainBlueprint("Create an inventory tracker for a vintage car collection");
        expect(bp).toContain("AWARD-WINNING FULL-STACK DIGITAL PRODUCT");
        expect(bp).toContain("Sticky Luxury Navigation Bar");
        expect(bp).toContain("Multi-View Architecture");
    });
});
