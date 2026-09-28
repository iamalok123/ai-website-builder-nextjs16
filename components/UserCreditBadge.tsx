'use client';

import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { PricingModal } from './PricingModal';
import { PLANS } from '@/lib/constants';
import { Plan } from '@/types/plans';
import { getUserCreditInfo, type UserCreditInfo } from '@/actions/user';

export function UserCreditBadge() {
    const [user, setUser] = useState<UserCreditInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        getUserCreditInfo()
            .then((data) => {
                if (isMounted && data) {
                    setUser(data);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return (
            <span
                aria-hidden="true"
                className="inline-flex h-8 w-28 items-center rounded-full border border-purple-500/20 bg-purple-500/5 px-3.5 animate-pulse"
            />
        );
    }

    if (!user) return null;

    return (
        <PricingModal>
            <span
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 text-xs font-medium text-purple-300 hover:text-white hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-200 cursor-pointer shadow-sm shadow-purple-500/10"
            >
                <Zap className="h-3.5 w-3.5 fill-purple-400 text-purple-400" />
                <span>{user.credits}</span>
                <span>/ {PLANS[user.plan as Plan]?.credits || 10} Credits</span>
            </span>
        </PricingModal>
    );
}
