// Where a sign-in may send someone afterwards: a path on this site, never another host. Browsers read "/\evil.com"
// and "/<tab>/evil.com" as "//evil.com", so a leading slash alone proves nothing; the path must also resolve here.

const BASE = "https://swami.invalid";

export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
