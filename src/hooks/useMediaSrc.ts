import { useEffect, useState } from "react";
import { needsMediaBypass, resolveMediaUrl } from "../lib/media";

/** Resolves src for <img>; on free ngrok returns a blob: URL after fetch bypass. */
export function useMediaSrc(src: string | null | undefined): string {
  const [resolved, setResolved] = useState(() =>
    src && !needsMediaBypass(src) ? src : ""
  );

  useEffect(() => {
    if (!src) {
      setResolved("");
      return;
    }
    if (!needsMediaBypass(src)) {
      setResolved(src);
      return;
    }
    let alive = true;
    setResolved("");
    void resolveMediaUrl(src)
      .then((u) => {
        if (alive) setResolved(u);
      })
      .catch(() => {
        if (alive) setResolved("");
      });
    return () => {
      alive = false;
    };
  }, [src]);

  return resolved;
}
