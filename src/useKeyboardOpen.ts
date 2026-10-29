import { useEffect, useState } from "react";

/** True when the on-screen keyboard likely covers part of the viewport (iOS/Android WebView). */
export function useKeyboardOpen(thresholdPx = 120): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const check = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setOpen(covered > thresholdPx);
    };

    check();
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    window.addEventListener("focusin", check);
    window.addEventListener("focusout", check);
    return () => {
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
      window.removeEventListener("focusin", check);
      window.removeEventListener("focusout", check);
    };
  }, [thresholdPx]);

  return open;
}

export function blurActiveInput() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
    el.blur();
  }
}
