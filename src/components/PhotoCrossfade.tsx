import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "../lib/media";

type Props = {
  src: string;
  className?: string;
};

function loadImage(url: string): Promise<string> {
  return resolveMediaUrl(url).then(
    (resolved) =>
      new Promise<string>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        const done = () => resolve(resolved);
        img.onload = () => {
          if (typeof img.decode === "function") {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
        };
        img.onerror = done;
        img.src = resolved;
        if (img.complete && img.naturalWidth > 0) {
          if (typeof img.decode === "function") {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
        }
      })
  );
}

/**
 * Keeps the previous frame until the next URL is decoded, then crossfades.
 * Remount per listing via key={listing.id} from the parent.
 */
export function PhotoCrossfade({ src, className }: Props) {
  const [frame, setFrame] = useState("");
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [fadeOn, setFadeOn] = useState(false);
  const gen = useRef(0);
  const frameRef = useRef("");
  const logicalRef = useRef("");
  frameRef.current = frame;

  useEffect(() => {
    if (!src) return;
    if (src === logicalRef.current && frameRef.current) {
      setOutgoing(null);
      setFadeOn(false);
      return;
    }

    const id = ++gen.current;
    let alive = true;
    const isFirst = !logicalRef.current;

    void (async () => {
      let resolved = "";
      try {
        resolved = await loadImage(src);
      } catch {
        return;
      }
      if (!alive || gen.current !== id) return;

      logicalRef.current = src;
      if (isFirst || !frameRef.current) {
        setFrame(resolved);
        setOutgoing(null);
        setFadeOn(false);
        return;
      }

      const prev = frameRef.current;
      setOutgoing(prev);
      setFadeOn(false);
      setFrame(resolved);

      requestAnimationFrame(() => {
        if (!alive || gen.current !== id) return;
        setFadeOn(true);
        window.setTimeout(() => {
          if (!alive || gen.current !== id) return;
          setOutgoing(null);
          setFadeOn(false);
        }, 200);
      });
    })();

    return () => {
      alive = false;
    };
  }, [src]);

  return (
    <div className={`photo-xfade${className ? ` ${className}` : ""}`}>
      {outgoing ? (
        <img
          src={outgoing}
          alt=""
          draggable={false}
          decoding="async"
          className="photo-xfade-img photo-xfade-out"
        />
      ) : null}
      {frame ? (
        <img
          src={frame}
          alt=""
          draggable={false}
          decoding="async"
          className={`photo-xfade-img photo-xfade-in${
            outgoing ? (fadeOn ? " is-on" : " is-prep") : " is-on"
          }`}
        />
      ) : null}
    </div>
  );
}
