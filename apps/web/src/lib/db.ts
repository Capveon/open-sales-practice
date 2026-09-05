import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postgres, { type Sql } from "postgres";

export type UserRow = {
  id: string;
  email: string | null;
  name: string;
  created_at: number;
};

export type CallRow = {
  id: string;
  user_id: string;
  profile_id: string;
  personality_json: string;
  status: string;
  started_at: number;
  ended_at: number | null;
  transcript_json: string;
  score_json: string | null;
  overall: number | null;
  voice_mode: string;
  room_name: string | null;
};

export type ClipRow = {
  id: string;
  call_id: string;
  seq: number;
  role: string;
  mime: string;
  at: number;
};

export type QueryResult = { rows: Record<string, unknown>[] };

const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  personality_json TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  transcript_json TEXT NOT NULL DEFAULT '[]',
  score_json TEXT,
  overall INTEGER,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  voice_mode TEXT NOT NULL,
  room_name TEXT
);
CREATE TABLE IF NOT EXISTS call_clips (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  mime TEXT NOT NULL,
  at INTEGER NOT NULL,
  bytes BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_user ON calls(user_id);
CREATE INDEX IF NOT EXISTS calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS calls_started ON calls(started_at);
CREATE INDEX IF NOT EXISTS clips_call ON call_clips(call_id, seq);
`;

function runtimeUrl(): string {
  return process.env.DATABASE_URL ?? "file:./data/osp.sqlite";
}

function adminUrl(): string {
  return process.env.DATABASE_ADMIN_URL?.trim() || runtimeUrl();
}

export function isPostgres(url = runtimeUrl()): boolean {
  return /^(postgres|postgresql):\/\//.test(url);
}

export function dbSchema(): string {
  if (!isPostgres()) return "";
  return process.env.OSP_DB_SCHEMA?.trim() || "osp";
}

function qualify(sql: string): string {
  const schema = dbSchema();
  if (!schema) return sql;
  const q = `"${schema.replace(/"/g, "")}"`;
  return sql
    .replace(/\bINTO users\b/g, `INTO ${q}.users`)
    .replace(/\bINTO calls\b/g, `INTO ${q}.calls`)
    .replace(/\bINTO call_clips\b/g, `INTO ${q}.call_clips`)
    .replace(/\bUPDATE users\b/g, `UPDATE ${q}.users`)
    .replace(/\bUPDATE calls\b/g, `UPDATE ${q}.calls`)
    .replace(/\bFROM users\b/g, `FROM ${q}.users`)
    .replace(/\bFROM calls\b/g, `FROM ${q}.calls`)
    .replace(/\bFROM call_clips\b/g, `FROM ${q}.call_clips`)
    .replace(/\bJOIN users\b/g, `JOIN ${q}.users`)
    .replace(/\bJOIN calls\b/g, `JOIN ${q}.calls`)
    .replace(/\bON calls\b/g, `ON ${q}.calls`)
    .replace(/\bON users\b/g, `ON ${q}.users`)
    .replace(/\bON call_clips\b/g, `ON ${q}.call_clips`);
}

function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function sslFor(url: string) {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    const host = parsed.hostname.toLowerCase();
    const mode = (parsed.searchParams.get("sslmode") ?? "").toLowerCase();
    if (mode === "disable") return false;
    if (
      mode === "require" ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".pooler.supabase.com")
    ) {
      return { rejectUnauthorized: false };
    }
    if (host === "localhost" || host === "127.0.0.1") return false;
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

function stripSslMode(url: string): string {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    parsed.searchParams.delete("sslmode");
    const next = parsed.toString().replace(/^postgresql:\/\//, "postgres://");
    return next.endsWith("?") ? next.slice(0, -1) : next;
  } catch {
    return url;
  }
}

let sqlite: Client | null = null;
let pg: Sql | null = null;
let pgAdmin: Sql | null = null;

function sqliteClient(): Client {
  if (sqlite) return sqlite;
  const url = runtimeUrl();
  const file = resolve(process.cwd(), url.slice("file:".length).replace(/^\.\//, ""));
  mkdirSync(dirname(file), { recursive: true });
  sqlite = createClient({ url: `file:${file}` });
  return sqlite;
}

function pgClient(url: string, cache: "runtime" | "admin"): Sql {
  if (cache === "runtime" && pg) return pg;
  if (cache === "admin" && pgAdmin) return pgAdmin;
  const sql = postgres(stripSslMode(url), {
    ssl: sslFor(url),
    max: 4,
    prepare: false,
  });
  if (cache === "runtime") pg = sql;
  else pgAdmin = sql;
  return sql;
}

export async function execute(query: { sql: string; args?: unknown[] }): Promise<QueryResult> {
  const sql = qualify(query.sql);
  const args = (query.args ?? []).map((a) => (a instanceof Uint8Array ? Buffer.from(a) : a));
  if (!isPostgres()) {
    const result = await sqliteClient().execute({
      sql,
      args: args as InValue[],
    });
    return { rows: result.rows as unknown as Record<string, unknown>[] };
  }
  const rows = await pgClient(runtimeUrl(), "runtime").unsafe(toPgPlaceholders(sql), args as never[]);
  return { rows: rows as unknown as Record<string, unknown>[] };
}

/** Back-compat with the old libsql client shape. */
export function db() {
  return { execute };
}

function postgresDdl(schema: string): string {
  const q = `"${schema.replace(/"/g, "")}"`;
  return `
CREATE SCHEMA IF NOT EXISTS ${q};
CREATE TABLE IF NOT EXISTS ${q}.users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${q}.calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  personality_json TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  transcript_json TEXT NOT NULL DEFAULT '[]',
  score_json TEXT,
  overall INTEGER,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  voice_mode TEXT NOT NULL,
  room_name TEXT
);
CREATE TABLE IF NOT EXISTS ${q}.call_clips (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  mime TEXT NOT NULL,
  at BIGINT NOT NULL,
  bytes BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_user ON ${q}.calls(user_id);
CREATE INDEX IF NOT EXISTS calls_status ON ${q}.calls(status);
CREATE INDEX IF NOT EXISTS calls_started ON ${q}.calls(started_at);
CREATE INDEX IF NOT EXISTS clips_call ON ${q}.call_clips(call_id, seq);
`;
}

export async function migrate() {
  if (!isPostgres()) {
    await sqliteClient().executeMultiple(SQLITE_DDL);
    return;
  }
  const schema = dbSchema() || "osp";
  const admin = pgClient(adminUrl(), "admin");
  await admin.unsafe(postgresDdl(schema));
  try {
    const q = `"${schema.replace(/"/g, "")}"`;
    await admin.unsafe(`GRANT USAGE ON SCHEMA ${q} TO capveon_app`);
    await admin.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${q} TO capveon_app`,
    );
  } catch {
    /* role is Capveon-specific; OSS postgres users own the schema they created */
  }
}
