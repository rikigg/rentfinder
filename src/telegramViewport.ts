/** Keep layout height in sync with Telegram’s Mini App viewport (esp. Desktop). */

const DESKTOP_PLATFORMS = new Set([
  "tdesktop",
  "macos",
  "web",
  "weba",
  "webk",
  "unigram",
]);

export function initTelegramViewport() {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
    return;
  }

  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();

  const platform = (tg.platform || "").toLowerCase();
  if (DESKTOP_PLATFORMS.has(platform) || (!platform && !("ontouchstart" in window))) {
    document.documentElement.classList.add("tg-desktop");
  }

  const sync = () => {
    const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
    if (h > 0) {
      document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
    }
  };

  sync();
  tg.onEvent?.("viewportChanged", sync);
  window.addEventListener("resize", sync);
}
