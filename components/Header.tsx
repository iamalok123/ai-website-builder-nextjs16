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
        <header className='fixed w-full top-0 left-0 z-50 h-16 border-b border-white/6 bg-white/7 backdrop-blur-md'>
            <nav className='mx-auto flex h-full max-w-7xl items-center justify-between px-2 sm:px-6'>
                <Link href="/">
                    <Image
                        src="/logo.svg"
                        alt="Zephyre"
                        width={50}
                        height={22}
                        className='h-7 w-auto'
                    />
                </Link>

                <div className='flex items-center gap-5' suppressHydrationWarning>
                    <Show when="signed-in">
                        <Link
                            href={"/projects"}
                            className='text-[13px] font-medium text-white/40 transition-colors hover:text-white/80'
                        >
                            Projects
                        </Link>

                        {user &&
                            <PricingModal>
                                <span
                                    className='inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:text-white/90 hover:bg-white/10 hover:border-white/30 transition-all duration-200'
                                >
                                    <Zap className='h-4 w-4 fill-white/70' />
                                    {user.credits} / {PLANS[user?.plan as Plan].credits} Credits
                                </span>
                            </PricingModal>
                        }
                        <UserButton />
                    </Show>


                    <Show when="signed-out">
                        <SignInButton mode="modal">
                            <Button variant="secondary">
                                <span>Sign In</span>
                            </Button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button>
                                <span>Sign Up</span>
                            </Button>
                        </SignUpButton>
                    </Show>

                </div>
            </nav>
        </header>
    )
}

export default Header