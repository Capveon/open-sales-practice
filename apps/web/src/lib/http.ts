export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.status >= 500 ? "Server error. Try again." : `Request failed (${res.status})`);
  }
}
