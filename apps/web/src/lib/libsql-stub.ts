/** Replaces @libsql/client in the Cloudflare build. SQLite is local-only. */
export type InValue = string | number | bigint | Uint8Array | null;
export type Client = {
  execute: (q: { sql: string; args?: InValue[] }) => Promise<{ rows: Record<string, unknown>[] }>;
  executeMultiple: (sql: string) => Promise<void>;
};

export function createClient(_opts: { url: string }): Client {
  throw new Error("SQLite is not available on this host. Set DATABASE_URL to a postgres URL.");
}
