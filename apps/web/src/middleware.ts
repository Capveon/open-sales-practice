import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/health"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  const { userId } = await auth();
  if (req.nextUrl.pathname.startsWith("/api")) {
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return;
  }
  if (!userId) {
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("redirect_url", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
