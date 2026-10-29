/**
 * Free ngrok serves an interstitial for bare <img> / Image() requests.
 * When the Mini App is on GitHub Pages, media still comes from the ngrok API host —
 * bypass via fetch + blob URL.
 */

import { absolutizeApiUrl, apiBase } from "./apiBase";

const cache = new Map<string, Promise<string>>();

function mediaHostIsNgrok(url: string): boolean {
  try {
    const base = apiBase() || (typeof window !== "undefined" ? window.location.origin : "");
    const u = new URL(url, base || "http://localhost");
    return /ngrok/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** True when <img src> would hit the free-ngrok warning page. */
export function needsMediaBypass(url: string): boolean {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;
  return mediaHostIsNgrok(url);
}

/**
 * Resolve a displayable src. On ngrok free, fetches with the skip header and
 * returns a blob: URL (cached). Elsewhere returns the original URL.
 */
export function resolveMediaUrl(url: string): Promise<string> {
  const absolute = absolutizeApiUrl(url);
  if (!absolute || !needsMediaBypass(absolute)) return Promise.resolve(absolute);

  let pending = cache.get(absolute);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(absolute, {
        headers: {
          Accept: "image/*,*/*",
          "ngrok-skip-browser-warning": "1",
        },
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`media ${res.status}`);
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const buf = await res.arrayBuffer();
      const head = new TextDecoder().decode(buf.slice(0, 96));
      if (
        ct.includes("text/") ||
        ct.includes("html") ||
        /ngrok|ERR_NGROK|Visit Site/i.test(head)
      ) {
        throw new Error("ngrok interstitial");
      }
      const mime = ct.startsWith("image/") ? ct : "image/jpeg";
      return URL.createObjectURL(new Blob([buf], { type: mime }));
    })().catch((err) => {
      cache.delete(absolute);
      throw err;
    });
    cache.set(absolute, pending);
  }
  return pending;
}

/** Warm decode cache for deck prefetch (same bypass as resolveMediaUrl). */
export function prefetchMedia(url: string | null | undefined): void {
  if (!url) return;
  void resolveMediaUrl(url)
    .then((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    })
    .catch(() => {});
}
