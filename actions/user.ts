"use server";

import { checkUser } from "@/lib/checkUser";

export interface UserCreditInfo {
    credits: number;
    plan: string;
    name?: string | null;
    email?: string | null;
}

export async function getUserCreditInfo(): Promise<UserCreditInfo | null> {
    try {
        const user = await checkUser();
        if (!user) return null;
        return {
            credits: user.credits,
            plan: user.plan,
            name: user.name,
            email: user.email,
        };
    } catch (error) {
        console.error("getUserCreditInfo error:", error);
        return null;
    }
}
