/** Empty = same-origin (Docker /app). Set VITE_API_BASE for GitHub Pages → ngrok API. */
export function apiBase(): string {
  return String(import.meta.env.VITE_API_BASE || "")
    .trim()
    .replace(/\/$/, "");
}

/** Prefix relative /media/... (and other API paths) when frontend is on another host. */
export function absolutizeApiUrl(url: string): string {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = apiBase();
  if (!base) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return url;
}

/** Walk JSON and rewrite string values that point at local media. */
export function absolutizeMediaInJson<T>(data: T): T {
  if (!apiBase()) return data;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (v.startsWith("/media/") || v === "/media") return absolutizeApiUrl(v);
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(data) as T;
}
