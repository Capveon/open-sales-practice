import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function asError(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
