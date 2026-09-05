import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

function clerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) &&
    process.env.OSP_AUTH !== "none";
}

const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const clerkGate = clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  if (req.nextUrl.pathname.startsWith("/api")) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return;
  }
  await auth.protect();
});

export default function middleware(req: NextRequest, event: unknown) {
  if (!clerkConfigured()) return NextResponse.next();
  return (clerkGate as (r: NextRequest, e: unknown) => NextResponse | Promise<Response>)(
    req,
    event,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
