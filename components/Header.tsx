import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { Button } from './ui/button'

const Header = () => {
    return (
        <header className='fixed w-full top-0 left-0 z-50 h-16 border-b border-white/6 bg-white/7 backdrop-blur-md'>
            <nav className='mx-auto flex h-full max-w-7xl items-center justify-between px-2 sm:px-6'>
                <Link href="/">
                    <Image
                        src="/logo.png"
                        alt="Forge"
                        width={100}
                        height={100}
                        className='h-9 w-auto rounded-md'
                    />
                </Link>

                <div className='flex items-center gap-5'>
                    <Show when="signed-in">
                        <Link
                            href={"/projects"}
                            className='text-[13px] font-medium text-white/40 transition-colors hover:text-white/80'
                        >
                            Projects
                        </Link>

                        <span
                            className='inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:text-white/90 hover:bg-white/10 hover:border-white/30 transition-all duration-200'
                        >
                            <Zap className='h-4 w-4 fill-white/70' />
                            3/40 Credits
                        </span>

                        <UserButton />
                    </Show>


                    <Show when="signed-out">
                        <SignInButton mode="modal">
                            <Button variant="secondary">
                                Sign In
                            </Button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button >
                                Sign Up
                            </Button>
                        </SignUpButton>
                    </Show>

                </div>
            </nav>
        </header>
    )
}

export default Header