import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Screen } from "../types";

const SWAP_MS = 340;

type Motion = "fade" | "forward" | "back";

/**
 * Navigation motion policy:
 * - forward/back — only hierarchical stack (settings depth, modePick→feed, paywall)
 * - fade — tabs, deck↔browse, waiting, onboarding, cross-branch jumps
 */
function motionBetween(from: Screen, to: Screen): Motion {
  if (to === "paywall") return "forward";
  if (from === "paywall") return "back";

  if (from === "settings" && (to === "filters" || to === "subscription")) {
    return "forward";
  }
  if ((from === "filters" || from === "subscription") && to === "settings") {
    return "back";
  }

  if (from === "modePick" && (to === "deck" || to === "browse")) return "forward";
  if ((from === "deck" || from === "browse") && to === "modePick") return "back";

  return "fade";
}

type Props = {
  screen: Screen;
  children: (screen: Screen) => ReactNode;
};

export function ScreenHost({ screen, children }: Props) {
  const [current, setCurrent] = useState(screen);
  const [outgoing, setOutgoing] = useState<Screen | null>(null);
  const [motion, setMotion] = useState<Motion>("fade");
  const currentRef = useRef(current);
  const timerRef = useRef(0);

  currentRef.current = current;

  useEffect(() => {
    if (screen === currentRef.current) return;

    const from = currentRef.current;
    setMotion(motionBetween(from, screen));
    setOutgoing(from);
    setCurrent(screen);

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setOutgoing(null);
    }, SWAP_MS);

    return () => window.clearTimeout(timerRef.current);
  }, [screen]);

  return (
    <div className={`screen-stage${outgoing ? " is-swapping" : ""}`}>
      {outgoing ? (
        <div
          className={`screen-layer screen-layer--exit screen-layer--${motion}`}
          aria-hidden
          inert
        >
          {children(outgoing)}
        </div>
      ) : null}
      <div key={current} className={`screen-layer screen-layer--enter screen-layer--${motion}`}>
        {children(current)}
      </div>
    </div>
  );
}
