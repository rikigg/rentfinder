/** Open URL from Mini App without closing the WebApp. */
export function openExternalUrl(url: string) {
  if (!url) return;
  const tg = window.Telegram?.WebApp;
  // Classic t.me links only — Mini App /startapp and deep invoice links often fail
  // openTelegramLink with WebKit "string did not match the expected pattern".
  const isClassicTg =
    /^https?:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_]+\/?(?:\?[^\s#]*)?(?:#[^\s]*)?$/i.test(
      url
    ) && !/[?&]startapp=/i.test(url);
  try {
    if (tg) {
      if (isClassicTg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(url);
        return;
      }
      if (typeof tg.openLink === "function") {
        tg.openLink(url, { try_instant_view: false });
        return;
      }
    }
  } catch {
    // fall through
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
