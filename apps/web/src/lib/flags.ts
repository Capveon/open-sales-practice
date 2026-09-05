export function clerkConfigured(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) &&
    process.env.OSP_AUTH !== "none"
  );
}
