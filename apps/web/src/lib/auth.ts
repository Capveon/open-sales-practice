import { auth, currentUser } from "@clerk/nextjs/server";
import { db, migrate, type UserRow } from "./db";
export { clerkConfigured } from "./flags";

export async function requireUser(): Promise<UserRow> {
  await migrate();
  const { userId } = await auth();
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const domain = process.env.OSP_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();
  if (domain && !email.toLowerCase().endsWith(`@${domain}`)) {
    throw new Response("This practice app is restricted to company accounts.", { status: 403 });
  }
  const name =
    clerkUser?.fullName || clerkUser?.firstName || email.split("@")[0] || "Rep";
  return upsertUser({ id: userId, email, name });
}

async function upsertUser(input: { id: string; email: string; name: string }): Promise<UserRow> {
  const existing = await db().execute({
    sql: "SELECT id, email, name, created_at FROM users WHERE id = ?",
    args: [input.id],
  });
  const row = existing.rows[0] as unknown as UserRow | undefined;
  if (row) {
    await db().execute({
      sql: "UPDATE users SET email = ?, name = ? WHERE id = ?",
      args: [input.email, input.name, input.id],
    });
    return { ...row, email: input.email, name: input.name };
  }
  const created_at = Date.now();
  await db().execute({
    sql: "INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)",
    args: [input.id, input.email, input.name, created_at],
  });
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    created_at,
  };
}
