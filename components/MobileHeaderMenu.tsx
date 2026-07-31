'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Zap } from 'lucide-react'
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs'
import { Button } from './ui/button'
import { PricingModal } from './PricingModal'
import { PLANS } from '@/lib/constants'
import { Plan } from '@/types/plans'

interface MobileHeaderMenuProps {
    user: {
        name?: string | null
        email?: string | null
        credits: number
        plan: string
    } | null
}

export const MobileHeaderMenu = ({ user }: MobileHeaderMenuProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const { user: clerkUser } = useUser()

    const displayName = user?.name || clerkUser?.fullName || clerkUser?.firstName || 'My Account'
    const displayEmail = user?.email || clerkUser?.primaryEmailAddress?.emailAddress || ''

    return (
        <div className="md:hidden flex items-center">
            {/* Menu Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle Navigation Menu"
                className="flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
                {isOpen ? (
                    <X className="h-5 w-5 text-zinc-200" />
                ) : (
                    <Menu className="h-5 w-5 text-zinc-200" />
                )}
            </button>

            {/* Mobile Menu Overlay Drawer */}
            {isOpen && (
                <>
                    {/* Dark Backdrop */}
                    <div
                        className="fixed inset-0 top-14 sm:top-16 bg-black/80 backdrop-blur-md z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu Panel */}
                    <div className="fixed inset-x-0 top-14 sm:top-16 z-50 border-b border-white/10 bg-[#07080e] p-5 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
                        <div className="flex flex-col gap-4 max-w-md mx-auto">
                            
                            {/* Navigation Links */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 px-1">
                                    Navigation
                                </span>
                                <Link
                                    href="/#overview"
                                    onClick={() => setIsOpen(false)}
                                    className="text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
                                >
                                    Overview
                                </Link>
                                <Link
                                    href="/#features"
                                    onClick={() => setIsOpen(false)}
                                    className="text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
                                >
                                    Features
                                </Link>
                                <Link
                                    href="/#how-it-works"
                                    onClick={() => setIsOpen(false)}
                                    className="text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
                                >
                                    How it works
                                </Link>
                                <Link
                                    href="/#pricing"
                                    onClick={() => setIsOpen(false)}
                                    className="text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
                                >
                                    Pricing
                                </Link>
                            </div>

                            <div className="h-px w-full bg-white/10" />

                            {/* User Account Section */}
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                                    Account
                                </span>

                                <Show when="signed-in">
                                    <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <UserButton />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-white truncate">
                                                    {displayName}
                                                </span>
                                                {displayEmail && (
                                                    <span className="text-[10px] text-zinc-400 truncate">
                                                        {displayEmail}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {user && (
                                            <PricingModal>
                                                <span className="shrink-0 inline-flex h-7 items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 text-xs font-medium text-purple-300 cursor-pointer hover:bg-purple-500/20 transition-all">
                                                    <Zap className="h-3.5 w-3.5 fill-purple-400 text-purple-400" />
                                                    {user.credits} / {PLANS[user?.plan as Plan]?.credits || 10} Credits
                                                </span>
                                            </PricingModal>
                                        )}
                                    </div>

                                    <Link
                                        href="/projects"
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center justify-center gap-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 py-2.5 rounded-xl transition-all"
                                    >
                                        Projects
                                    </Link>
                                </Show>

                                <Show when="signed-out">
                                    <div className="flex flex-col gap-2">
                                        <SignInButton mode="modal">
                                            <Button
                                                variant="secondary"
                                                className="w-full text-xs font-medium text-zinc-200 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl h-10"
                                            >
                                                Log in
                                            </Button>
                                        </SignInButton>
                                        <SignUpButton mode="modal">
                                            <Button className="w-full text-xs font-semibold bg-white text-black hover:bg-zinc-200 rounded-xl h-10 shadow-md shadow-white/10">
                                                Start free
                                            </Button>
                                        </SignUpButton>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
