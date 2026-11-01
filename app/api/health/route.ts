import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

// Prevent Next.js static optimization or CDN caching so every request reaches the Node server process
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  let dbStatus = "unknown";
  try {
    // Lightweight database query to keep Supabase pooler & database active
    await db.user.findFirst({ select: { id: true } });
    dbStatus = "connected";
  } catch (error) {
    dbStatus = "disconnected";
    console.warn("[Health Check] Database ping failed:", error);
  }

  return NextResponse.json(
    {
      status: dbStatus === "connected" ? "ok" : "degraded",
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

// Allow HEAD and POST pings from uptime checkers and cron services
export { GET as HEAD, GET as POST };
