import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { Button } from './ui/button'
import { PricingModal } from './PricingModal'
import { checkUser } from '@/lib/checkUser'
import { PLANS } from '@/lib/constants'
import { Plan } from '@/types/plans'
import { MobileHeaderMenu } from './MobileHeaderMenu'

const Header = async () => {
    const user = await checkUser()
    return (
        <header className='fixed w-full top-3 sm:top-4 inset-x-0 z-50 px-3 sm:px-6 lg:px-8 pointer-events-none'>
            <nav className='relative mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 rounded-2xl border border-white/12 bg-[#08090e]/85 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto transition-all duration-300 hover:border-white/20'>
                <div className="flex items-center">
                    <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group transition-transform hover:scale-[1.02]">
                        <Image
                            src="/logo.svg"
                            alt="Zephyre"
                            width={36}
                            height={18}
                            className='h-5 sm:h-6 w-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.35)]'
                            priority
                        />
                        <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white group-hover:text-amber-300 transition-colors">
                            Zephyre
                        </span>
                    </Link>
                </div>

                {/* Centered Navigation Points (Desktop) */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-5 lg:gap-7 text-xs sm:text-sm font-medium">
                    <Link
                        href="/#hero"
                        className="text-zinc-400 hover:text-white transition-colors duration-200"
                    >
                        Overview
                    </Link>
                    <Link
                        href="/#demo"
                        className="text-zinc-400 hover:text-white transition-colors duration-200"
                    >
                        Mockup
                    </Link>
                    <Link
                        href="/#features"
                        className="text-zinc-400 hover:text-white transition-colors duration-200"
                    >
                        Features
                    </Link>
                    <Link
                        href="/#how-it-works"
                        className="text-zinc-400 hover:text-white transition-colors duration-200 whitespace-nowrap"
                    >
                        How it works
                    </Link>
                    <Link
                        href="/#pricing"
                        className="text-zinc-400 hover:text-white transition-colors duration-200"
                    >
                        Pricing
                    </Link>
                    <Link
                        href="/#faq"
                        className="text-zinc-400 hover:text-white transition-colors duration-200"
                    >
                        FAQ
                    </Link>
                </div>

                {/* Desktop Account & Action Buttons */}
                <div className='hidden md:flex items-center gap-4' suppressHydrationWarning>
                    <Show when="signed-in">
                        <Link
                            href={"/projects"}
                            className='text-xs font-medium text-zinc-300 transition-colors hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 px-3.5 py-1.5 rounded-full'
                        >
                            Projects
                        </Link>

                        {user &&
                            <PricingModal>
                                <span
                                    className='inline-flex h-8 items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 text-xs font-medium text-purple-300 hover:text-white hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-200 cursor-pointer shadow-sm shadow-purple-500/10'
                                >
                                    <Zap className='h-3.5 w-3.5 fill-purple-400 text-purple-400' />
                                    <span>{user.credits}</span>
                                    <span>/ {PLANS[user?.plan as Plan]?.credits || 10} Credits</span>
                                </span>
                            </PricingModal>
                        }
                        <UserButton />
                    </Show>

                    <Show when="signed-out">
                        <SignInButton mode="modal">
                            <Button variant="secondary" className="text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-full px-4 h-9">
                                Log in
                            </Button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button className="text-xs font-semibold bg-white text-black hover:bg-zinc-200 rounded-full px-4 py-1.5 h-9 shadow-md shadow-white/10 transition-all hover:scale-105 active:scale-95">
                                Start free
                            </Button>
                        </SignUpButton>
                    </Show>
                </div>

                {/* Mobile Menu with Triple Dots (Mobile View) */}
                <MobileHeaderMenu user={user} />
            </nav>
        </header>
    )
}

export default Header