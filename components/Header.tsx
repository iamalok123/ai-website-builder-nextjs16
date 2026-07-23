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

const Header = async () => {
    const user = await checkUser()
    return (
        <header className='fixed w-full top-0 left-0 z-50 h-16 border-b border-white/10 bg-[#090a0f]/80 backdrop-blur-xl transition-all duration-300'>
            <nav className='mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.02]">
                        <Image
                            src="/logo.svg"
                            alt="Zephyre"
                            width={40}
                            height={20}
                            className='h-6 w-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.35)]'
                            priority
                        />
                        <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-amber-300 transition-colors">
                            Zephyre
                        </span>
                    </Link>
                </div>

                <div className='flex items-center gap-4' suppressHydrationWarning>
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
                                    {user.credits} / {PLANS[user?.plan as Plan].credits} Credits
                                </span>
                            </PricingModal>
                        }
                        <UserButton />
                    </Show>

                    <Show when="signed-out">
                        <SignInButton mode="modal">
                            <Button variant="secondary" className="text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-full px-4">
                                Log in
                            </Button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button className="text-xs font-semibold bg-white text-black hover:bg-zinc-200 rounded-full px-4 py-2 shadow-md shadow-white/10 transition-all hover:scale-105 active:scale-95">
                                Start for free
                            </Button>
                        </SignUpButton>
                    </Show>
                </div>
            </nav>
        </header>
    )
}

export default Header