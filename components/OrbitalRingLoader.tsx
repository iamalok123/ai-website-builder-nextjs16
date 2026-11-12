import { cn } from "@/lib/utils";

interface OrbitalRingLoaderProps {
    size?: number;
    color?: string;
    opacity?: number;
    className?: string;
}

/**
 * Server-safe crisp white-only circular spinning loader using pure CSS animation
 * so it spins smoothly from the first SSR frame without client JS.
 */
export function OrbitalRingLoader({
    size = 40,
    color = "#ffffff",
    opacity = 1,
    className,
}: OrbitalRingLoaderProps) {
    return (
        <span
            aria-hidden="true"
            className={cn("inline-flex items-center justify-center shrink-0", className)}
            style={{ width: size, height: size, opacity }}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 40 40"
                fill="none"
                className="zephyre-orbital-ring-spin block"
            >
                <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke={color}
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeDasharray="68 101"
                />
            </svg>
        </span>
    );
}
