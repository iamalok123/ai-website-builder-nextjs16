export const PLANS = {
    free: {
        label: "Free",
        credits: 10,
        price: 0,
    },
    standard: {
        label: "Standard",
        credits: 50,
        price: 9,
    },
    pro: {
        label: "Pro",
        credits: 150,
        price: 29,
    },
} as const;

export const CREDIT_COST_PER_GENERATION = 1;

export const MIN_CREDITS_TO_GENERATE = 1;

export const PRICING_PLANS = [
    {
        key: "free",
        label: "Free",
        description: "Start building. No credit card required.",
        price: 0,
        featured: false,
        planId: null,
        active: true,
        features: ["10 Generations / Month", "Live Preview", "Export to ZIP"],
    },
    {
        key: "standard",
        label: "Standard",
        description: "For developers who build regularly.",
        price: 9,
        featured: true,
        planId: process.env.NEXT_PUBLIC_CLERK_STANDARD_PLAN_ID || "",
        active: false,
        features: [
            "50 Generations / Month",
            "Image Uploads",
            "Live Preview",
            "Export to ZIP",
        ],
    },
    {
        key: "pro",
        label: "Pro",
        description: "For power users who ship fast.",
        price: 29,
        featured: false,
        planId: process.env.NEXT_PUBLIC_CLERK_PRO_PLAN_ID || "",
        active: false,
        features: [
            "150 Generations / Month",
            "Priority AI (Faster AI Response)",
            "Live Preview",
            "Export to Zip",
            "Image Uploads",
            "Access to Zephyre Pro Agent",
        ],
    },
] as const;