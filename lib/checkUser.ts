import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";
import { PLANS } from "./constants";
import { Plan } from "../types/plans";


export const checkUser = async () => {
    const { userId: clerkId, has } = await auth();
    if (!clerkId) return null;

    const currentPlan: Plan = has({ plan: "pro" })
        ? "pro"
        : has({ plan: "standard" })
        ? "standard"
        : "free";

    try {
        const existing = await db.user.findUnique({
            where: { clerkId },
        });

        // If a user already exists in DB, avoid a remote Clerk currentUser() API call
        if (existing) {
            if (existing.plan !== currentPlan) {
                // Only top up credits on upgrade (positive delta), not on downgrade
                const existingPlanCredits = PLANS[existing.plan as Plan]?.credits ?? 0;
                const newPlanCredits = PLANS[currentPlan].credits;
                const creditDelta = newPlanCredits - existingPlanCredits;

                // Use updateMany with the old plan in the where clause to prevent
                // race conditions from double-crediting on concurrent requests
                await db.user.updateMany({
                    where: { clerkId, plan: existing.plan },
                    data: {
                        plan: currentPlan,
                        credits:
                            creditDelta > 0
                                ? existing.credits + creditDelta
                                : existing.credits,
                    },
                });

                // Re-fetch and return the updated record
                return await db.user.findUnique({ where: { clerkId } });
            }

            return existing;
        }

        // Only fetch full Clerk profile when provisioning a brand-new user record
        const user = await currentUser();
        if (!user) return null;

        const name =
            `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
            user.username ||
            "User";
        const email =
            user.emailAddresses?.[0]?.emailAddress ||
            `${clerkId}@clerk.local`;

        // New user — create with free plan credits (or active plan if newly assigned)
        return await db.user.create({
            data: {
                clerkId,
                name,
                email,
                imageUrl: user.imageUrl ?? "",
                credits: PLANS[currentPlan].credits,
                plan: currentPlan,
            },
        });
    } catch (error) {
        console.error("checkUser error:", error);
        // Resilient fallback: If user was created concurrently, fetch and return it
        try {
            return await db.user.findUnique({ where: { clerkId } });
        } catch {
            return null;
        }
    }
};
