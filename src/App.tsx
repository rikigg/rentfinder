import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BrowseScreen } from "./screens/BrowseScreen";
import { DeckScreen } from "./screens/DeckScreen";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { FiltersScreen } from "./screens/FiltersScreen";
import { ModePickScreen } from "./screens/ModePickScreen";
import { ONBOARD_SLIDES, Onboarding } from "./screens/Onboarding";
import { PaywallScreen } from "./screens/PaywallScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SubscriptionScreen } from "./screens/SubscriptionScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { WelcomeSplash } from "./screens/WelcomeSplash";
import { ScreenHost } from "./components/ScreenHost";
import {
  IconDiscover,
  IconFavorites,
  IconSettings,
} from "./icons";
import { ThemePicker } from "./components/ThemePicker";
import { initTheme, setThemeMode, type ThemeMode } from "./theme";
import type {
  AdCard,
  DeckCard,
  ListingOut,
  MeOut,
  NotifyMode,
  PayMethod,
  Screen,
  SearchParams,
  ViewMode,
} from "./types";
import { isAdCard } from "./types";
import { openExternalUrl } from "./lib/openUrl";
import { useKeyboardOpen } from "./useKeyboardOpen";

const ONBOARD_KEY = "rentfinder_onboarding_v4";
const WELCOME_MIN_MS = 2200;
const WELCOME_EXIT_MS = 420;

function viewModeOf(data?: MeOut | null): ViewMode | null {
  const m = data?.user.view_mode;
  return m === "deck" || m === "browse" ? m : null;
}

/** FastAPI error body is JSON string in Error.message. */
function apiErrorDetail(e: unknown): {
  error?: string;
  favorites_count?: number;
  favorites_max?: number | null;
  swipes_left?: number;
} {
  const msg = e instanceof Error ? e.message : "";
  try {
    const j = JSON.parse(msg) as { detail?: unknown };
    const d = j?.detail ?? j;
    if (d && typeof d === "object") return d as ReturnType<typeof apiErrorDetail>;
  } catch {
    /* plain text */
  }
  return { error: msg };
}

function patchFavQuota(
  prev: MeOut | null,
  count?: number,
  max?: number | null
): MeOut | null {
  if (!prev) return prev;
  const next = { ...prev };
  if (typeof count === "number") next.favorites_count = count;
  if (max !== undefined) next.favorites_max = max;
  return next;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [onboardStep, setOnboardStep] = useState(0);
  const [me, setMe] = useState<MeOut | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const swipesSinceAdRef = useRef(0);
  const adsRef = useRef<MeOut["ads"] | undefined>(undefined);
  const [favorites, setFavorites] = useState<ListingOut[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [resultsCount, setResultsCount] = useState(0);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallMode, setPaywallMode] = useState<"trial" | "renew">("trial");
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => initTheme());
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [splash, setSplash] = useState(true);
  const [splashOut, setSplashOut] = useState(false);
  const [filterDraft, setFilterDraft] = useState<SearchParams | null>(null);
  const splashStarted = useRef(Date.now());
  const pendingScreen = useRef<Screen | null>(null);
  const splashTimer = useRef<number | null>(null);
  /** true when guide opened from Settings — never persist filters from that pass */
  const onboardFromSettings = useRef(false);
  /** mode pick opened from Settings to change preference (show back) */
  const modePickFromSettings = useRef(false);
  /** first-run guide only: allow creating filter + starting parse from onboarding */
  const onboardPersistFilters = useRef(true);
  const onboardFilterId = useRef<number | null>(null);
  const onboardTaskId = useRef<string | null>(null);
  const onboardCommitInFlight = useRef<Promise<void> | null>(null);

  const revealAfterSplash = useCallback((next: Screen) => {
    pendingScreen.current = next;
    const elapsed = Date.now() - splashStarted.current;
    const wait = Math.max(0, WELCOME_MIN_MS - elapsed);
    if (splashTimer.current) window.clearTimeout(splashTimer.current);
    splashTimer.current = window.setTimeout(() => {
      setScreen(pendingScreen.current || next);
      setSplashOut(true);
      window.setTimeout(() => setSplash(false), WELCOME_EXIT_MS);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    }, wait);
  }, []);

  const loadFeed = useCallback(async () => {
    const feed = await api.feed(40);
    setCards(feed);
    return feed;
  }, []);

  const syncAdsFromMe = useCallback((data: MeOut) => {
    adsRef.current = data.ads;
    const deckImg =
      data.ads?.deck?.image_url || data.ads?.image_url || null;
    const live = !!(data.ads?.enabled && deckImg);
    if (!live) {
      swipesSinceAdRef.current = 0;
      setCards((prev) => {
        if (!prev.some(isAdCard)) return prev;
        return prev.filter((c) => !isAdCard(c));
      });
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const data = await api.me();
    setMe(data);
    setCanUndo(data.can_undo);
    syncAdsFromMe(data);
    return data;
  }, [syncAdsFromMe]);

  /** Live ads toggle from admin — no service restart; poll while browsing/swiping. */
  useEffect(() => {
    if (screen !== "deck" && screen !== "browse") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.me();
        if (cancelled) return;
        setMe((prev) => (prev ? { ...prev, ads: data.ads } : data));
        syncAdsFromMe(data);
      } catch {
        /* ignore transient poll errors */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 10_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [screen, syncAdsFromMe]);

  const bootstrap = useCallback(async () => {
    setError(null);
    try {
      const data = await refreshMe();
      // Returning users: skip guide even if localStorage wiped (new tunnel domain = new origin).
      // After admin delete, server is a fresh user — never skip guide via localStorage alone.
      const swipeTotal = data.swipes_total ?? data.trial_listings_total ?? 30;
      const swipeLeft = data.swipes_left ?? swipeTotal;
      const returningUser =
        !!data.active_filter ||
        (data.filters?.length ?? 0) > 0 ||
        !!data.last_task_id ||
        data.has_subscription ||
        swipeLeft < swipeTotal ||
        (data.favorites_count ?? 0) > 0;
      const localDone = localStorage.getItem(ONBOARD_KEY) === "1";
      if (returningUser && !localDone) {
        localStorage.setItem(ONBOARD_KEY, "1");
      }
      if (!returningUser && localDone) {
        localStorage.removeItem(ONBOARD_KEY);
      }
      const onboardDone = returningUser;
      if (!onboardDone) {
        onboardFromSettings.current = false;
        onboardPersistFilters.current = true;
        onboardFilterId.current = null;
        onboardTaskId.current = null;
        onboardCommitInFlight.current = null;
        setOnboardStep(0);
        revealAfterSplash("onboarding");
        return;
      }
      if (!data.active_filter) {
        revealAfterSplash("filters");
        return;
      }
      if (
        data.last_task_id &&
        data.last_task_status &&
        ["queued", "running", "pending"].includes(data.last_task_status)
      ) {
        setTaskId(data.last_task_id);
        setTaskStatus(data.last_task_status);
        revealAfterSplash("waiting");
        return;
      }
      await loadFeed();
      const mode = viewModeOf(data);
      if (!mode) {
        modePickFromSettings.current = false;
        revealAfterSplash("modePick");
      } else if (mode === "browse") {
        revealAfterSplash("browse");
      } else {
        revealAfterSplash("deck");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      revealAfterSplash("settings");
    }
  }, [loadFeed, refreshMe, revealAfterSplash]);

  useEffect(() => {
    void bootstrap();
    return () => {
      if (splashTimer.current) window.clearTimeout(splashTimer.current);
    };
  }, [bootstrap]);
  useEffect(() => {
    if (screen !== "waiting" || !taskId) return;
    let cancelled = false;
    let pollErrors = 0;
    const tick = async () => {
      try {
        const st = await api.searchStatus(taskId);
        if (cancelled) return;
        pollErrors = 0;
        setTaskStatus(st.status);
        setResultsCount(st.results_count || 0);
        setFailedSources(st.failed_sources || []);
        setSearchError(st.error || null);
        if (st.status === "done") {
          await loadFeed();
          const latest = await refreshMe();
          goToListings(latest);
          return;
        }
        // Light sources often return first; open deck as soon as partial hits land.
        if (st.status === "running" && (st.listing_ids?.length || 0) >= 5) {
          await loadFeed();
          const latest = await refreshMe();
          goToListings(latest);
          return;
        }
        if (st.status === "failed" || st.status === "cancelled") {
          await refreshMe();
          // stay on waiting with error UI
        }
      } catch {
        pollErrors += 1;
        if (pollErrors >= 8) {
          setTaskStatus("failed");
          setSearchError("Нет связи с сервером");
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [screen, taskId, loadFeed, refreshMe]);

  function isOnboardingDraftValid(draft?: SearchParams | null) {
    if (!draft?.city || draft.price_max == null) return false;
    return draft.property_type === "room" || (draft.rooms?.length ?? 0) > 0;
  }

  /** First-run only: create/update filter + start parse while user finishes the guide. */
  function commitOnboardingFilters(params: SearchParams) {
    if (!onboardPersistFilters.current || onboardFromSettings.current) return;
    // Fire-and-forget: parse starts while the user finishes the guide.
    const run = (async () => {
      try {
        const res =
          onboardFilterId.current != null
            ? await api.updateFilter(onboardFilterId.current, params, { startParse: true })
            : await api.setActiveFilter(params, {
                startParse: true,
                createNew: true,
              });
        if (res.filter?.id) {
          const isNew = onboardFilterId.current == null;
          onboardFilterId.current = res.filter.id;
          if (isNew) {
            try {
              await api.setNotifyMode(res.filter.id, "on_new");
            } catch {
              /* notify is secondary */
            }
          }
        }
        await refreshMe();
        if (res.task_id) {
          onboardTaskId.current = res.task_id;
          setTaskId(res.task_id);
          setTaskStatus(res.status);
        } else {
          console.warn("[onboarding] filters saved but no task_id returned");
        }
      } catch (e) {
        console.error("[onboarding] commitOnboardingFilters failed", e);
        setError(e instanceof Error ? e.message : "Не удалось сохранить фильтр");
      }
    })();
    onboardCommitInFlight.current = run;
    void run.finally(() => {
      if (onboardCommitInFlight.current === run) onboardCommitInFlight.current = null;
    });
  }

  async function finishOnboarding(draft?: SearchParams | null) {
    localStorage.setItem(ONBOARD_KEY, "1");
    if (onboardFromSettings.current || !onboardPersistFilters.current) {
      onboardFromSettings.current = false;
      onboardPersistFilters.current = true;
      onboardFilterId.current = null;
      onboardTaskId.current = null;
      onboardCommitInFlight.current = null;
      setScreen("settings");
      return;
    }

    // Wait for background commit from the filters step (if any).
    if (onboardCommitInFlight.current) {
      try {
        await onboardCommitInFlight.current;
      } catch {
        /* error already surfaced */
      }
    }

    if (onboardFilterId.current != null || me?.active_filter) {
      const pendingTask = onboardTaskId.current || taskId;
      if (pendingTask) {
        setTaskId(pendingTask);
        setScreen("waiting");
        return;
      }
      const latest = await refreshMe().catch(() => me);
      if (
        latest?.last_task_id &&
        latest.last_task_status &&
        ["queued", "running", "pending"].includes(latest.last_task_status)
      ) {
        onboardTaskId.current = latest.last_task_id;
        setTaskId(latest.last_task_id);
        setTaskStatus(latest.last_task_status);
        setScreen("waiting");
        return;
      }
      try {
        await loadFeed();
      } catch {
        /* deck can retry */
      }
      goToListings(latest ?? me);
      return;
    }

    if (isOnboardingDraftValid(draft)) {
      void saveFilters(draft!, { createNew: true, notifyMode: "on_new" });
      return;
    }
    setFilterDraft(draft ?? null);
    setScreen("filters");
  }

  function openOnboarding() {
    onboardFromSettings.current = true;
    onboardPersistFilters.current = false;
    onboardFilterId.current = null;
    onboardTaskId.current = null;
    onboardCommitInFlight.current = null;
    setOnboardStep(0);
    setScreen("onboarding");
  }

  function goToListings(data?: MeOut | null, opts?: { refreshDeck?: boolean }) {
    const snap = data ?? me;
    if (!snap?.active_filter) {
      setScreen("filters");
      return;
    }
    const mode = viewModeOf(snap);
    if (!mode) {
      modePickFromSettings.current = false;
      setScreen("modePick");
      return;
    }
    if (mode === "browse") {
      setScreen("browse");
      return;
    }
    goDeck(opts?.refreshDeck ?? false, snap);
  }

  function openSearchTab() {
    goToListings(me, { refreshDeck: false });
  }

  function openViewModeSettings() {
    modePickFromSettings.current = true;
    setScreen("modePick");
  }

  async function pickViewMode(mode: ViewMode) {
    setError(null);
    try {
      const user = await api.setViewMode(mode);
      setMe((prev) =>
        prev ? { ...prev, user: { ...prev.user, view_mode: user.view_mode ?? mode } } : prev
      );
      modePickFromSettings.current = false;
      if (mode === "browse") {
        setScreen("browse");
        return;
      }
      goDeck(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить способ просмотра");
    }
  }

  function openBrowse() {
    if (!me?.active_filter) {
      setScreen("filters");
      return;
    }
    setScreen("browse");
  }

  function openSubscription() {
    if (me?.has_subscription) setScreen("subscription");
    else {
      void openTrialPaywall();
    }
  }

  /** Open plan screen with fresh swipe/favorites counters from /me. */
  async function openTrialPaywall(opts?: {
    favoritesCount?: number;
    favoritesMax?: number | null;
  }) {
    setError(null);
    setPaywallMode("trial");
    if (opts && (typeof opts.favoritesCount === "number" || opts.favoritesMax !== undefined)) {
      setMe((prev) => patchFavQuota(prev, opts.favoritesCount, opts.favoritesMax));
    }
    setScreen("paywall");
    try {
      await refreshMe();
    } catch {
      /* keep optimistic counters */
    }
  }

  async function saveFilters(
    params: SearchParams,
    opts?: {
      createNew?: boolean;
      filterId?: number;
      notifyMode?: NotifyMode;
      startParse?: boolean;
    }
  ) {
    const startParse = opts?.startParse !== false;
    setBusy(true);
    setError(null);
    try {
      const res =
        opts?.filterId != null
          ? await api.updateFilter(opts.filterId, params, { startParse })
          : await api.setActiveFilter(params, {
              startParse,
              createNew: opts?.createNew ?? true,
            });
      if (opts?.notifyMode && res.filter?.id) {
        try {
          await api.setNotifyMode(res.filter.id, opts.notifyMode);
        } catch {
          /* notify is secondary to search */
        }
      }
      const latest = await refreshMe();
      if (!startParse) {
        // Stay on filters list — FiltersScreen calls backToList after await.
        return;
      }
      if (res.quota_error) {
        setScreen("paywall");
        return;
      }
      if (res.task_id) {
        setTaskId(res.task_id);
        setTaskStatus(res.status);
        setScreen("waiting");
        return;
      }
      await loadFeed();
      goToListings(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function activateFilter(id: number) {
    setBusy(true);
    try {
      const res = await api.activateFilter(id, true);
      const latest = await refreshMe();
      if (res.quota_error) {
        setScreen("paywall");
        return;
      }
      if (res.task_id) {
        setTaskId(res.task_id);
        setTaskStatus(res.status);
        setScreen("waiting");
        return;
      }
      await loadFeed();
      goToListings(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка фильтра");
    } finally {
      setBusy(false);
    }
  }

  async function openFavorites() {
    setScreen("favorites");
    setFavLoading(true);
    try {
      setFavorites(await api.favorites());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка избранного");
    } finally {
      setFavLoading(false);
    }
  }

  function goDeck(refresh = false, _snap?: MeOut | null) {
    setScreen("deck");
    if (refresh || cards.length === 0) {
      void loadFeed().catch(() => {
        /* keep current cards */
      });
    }
  }

  /** Swipe does not debit trial quota (only Описание / Объявление). */
  async function onSwipe(card: DeckCard, direction: "left" | "right") {
    if (isAdCard(card)) return;
    setCanUndo(true);
    try {
      const res = await api.swipe(card.id, direction);
      setCanUndo(res.can_undo);
      setMe((prev) => patchFavQuota(prev, res.favorites_count, res.favorites_max) ?? prev);
    } catch (e) {
      setCards((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
      const detail = apiErrorDetail(e);
      const msg = e instanceof Error ? e.message : "";
      if (
        detail.error === "favorites_limit" ||
        msg.includes("favorites_limit") ||
        msg.includes("402")
      ) {
        void openTrialPaywall({
          favoritesCount: detail.favorites_count,
          favoritesMax: detail.favorites_max,
        });
        return;
      }
      throw e;
    }
  }

  /** Debit trial once per listing on Описание / Объявление. Returns false if blocked. */
  async function engageListing(listingId: number): Promise<boolean> {
    try {
      const res = await api.listingOutbound(listingId);
      setMe((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (typeof res.swipes_left === "number") {
          next.swipes_left = res.swipes_left;
          next.swipes_total = res.swipes_total ?? next.swipes_total;
        }
        if (typeof res.trial_listings_left === "number") {
          next.trial_listings_total = next.trial_listings_total ?? next.swipes_total;
        }
        return next;
      });
      if (res.trial_ended) {
        void openTrialPaywall();
      }
      return true;
    } catch (e) {
      const detail = apiErrorDetail(e);
      const msg = e instanceof Error ? e.message : "";
      if (
        detail.error === "swipe_quota" ||
        msg.includes("swipe_quota") ||
        msg.includes("402")
      ) {
        void openTrialPaywall();
        return false;
      }
      setError(e instanceof Error ? e.message : "Не удалось открыть");
      return false;
    }
  }

  async function openListingOutbound(listing: ListingOut, url: string) {
    if (!url) return;
    const ok = await engageListing(listing.id);
    if (ok) openExternalUrl(url);
  }

  function onAdvanceDeck(cardId: number | string) {
    setCards((prev) => {
      const removed = prev.find((c) => c.id === cardId);
      const rest = prev.filter((c) => c.id !== cardId);
      if (!removed || isAdCard(removed)) {
        return rest;
      }
      swipesSinceAdRef.current += 1;
      const ads = adsRef.current ?? me?.ads;
      const freq = Math.max(1, ads?.frequency ?? 5);
      const deckImg = ads?.deck?.image_url || ads?.image_url || null;
      const deckClick = ads?.deck?.click_url ?? ads?.click_url ?? null;
      if (ads?.enabled && deckImg && swipesSinceAdRef.current >= freq) {
        swipesSinceAdRef.current = 0;
        const ad: AdCard = {
          kind: "ad",
          id: `ad-${Date.now()}`,
          image_url: deckImg,
          click_url: deckClick,
        };
        return [ad, ...rest];
      }
      return rest;
    });
  }

  async function onUndo() {
    try {
      const res = await api.undo();
      setCanUndo(res.can_undo);
      setCards((prev) => [res.listing, ...prev.filter((c) => c.id !== res.listing.id)]);
      setMe((prev) => patchFavQuota(prev, res.favorites_count, res.favorites_max));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setCanUndo(false);
    }
  }

  async function onResetPasses() {
    await api.resetPasses();
    await loadFeed();
    goToListings(me, { refreshDeck: false });
  }

  async function onShare() {
    setSharing(true);
    try {
      await api.shareFavorites();
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSharing(false);
    }
  }

  async function onStarsPay() {
    setPayBusy(true);
    setPayMethod("stars");
    setError(null);
    let waitingInvoice = false;
    try {
      const inv = await api.createInvoice();
      if (inv.dev || !inv.invoice_url) {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
        const latest = await refreshMe();
        await loadFeed();
        goToListings(latest);
        return;
      }
      const openInvoice = window.Telegram?.WebApp?.openInvoice;
      if (!openInvoice) {
        setError("Откройте приложение в Telegram для оплаты");
        return;
      }
      waitingInvoice = true;
      try {
        openInvoice(inv.invoice_url, async (status) => {
          if (status === "paid") {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
            const latest = await refreshMe();
            await loadFeed();
            goToListings(latest);
          } else if (status === "failed") {
            setError("Оплата не прошла");
          }
          setPayBusy(false);
          setPayMethod(null);
        });
      } catch (invoiceErr) {
        waitingInvoice = false;
        const msg = invoiceErr instanceof Error ? invoiceErr.message : "";
        setError(
          msg.toLowerCase().includes("pattern") || msg.toLowerCase().includes("invalid")
            ? "Не удалось открыть оплату Stars. Попробуйте Tribute или /start."
            : msg || "Ошибка оплаты Stars"
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.toLowerCase().includes("pattern")
          ? "Не удалось открыть оплату. Обновите Mini App через /start."
          : msg || "Ошибка оплаты"
      );
    } finally {
      if (!waitingInvoice) {
        setPayBusy(false);
        setPayMethod(null);
      }
    }
  }

  function onTributePay() {
    setPayMethod("tribute");
    setError(null);
    const url =
      me?.tribute_url || "https://t.me/tribute/app?startapp=s19uh";
    openExternalUrl(url);
    setPayMethod(null);
  }

  const keyboardOpen = useKeyboardOpen();
  const chromeHidden =
    splash || screen === "onboarding" || screen === "loading" || screen === "paywall";

  return (
    <div className={`app${keyboardOpen ? " kb-open" : ""}`}>
      {splash ? <WelcomeSplash exiting={splashOut} /> : null}

      {themePickerOpen ? (
        <ThemePicker
          current={theme}
          onSelect={(mode) => setTheme(setThemeMode(mode))}
          onClose={() => setThemePickerOpen(false)}
        />
      ) : null}

      <main className="screen-host">
        <ScreenHost screen={screen}>
          {(s) => {
            if (s === "onboarding") {
              return (
                <Onboarding
                  step={onboardStep}
                  city={me?.user.city || "Москва"}
                  telegramParse={!!me?.features?.telegram_parse}
                  sourcesEnabled={me?.features?.sources}
                  sourcesShowcase={!!me?.features?.sources_showcase}
                  persistFilters={onboardPersistFilters.current && !onboardFromSettings.current}
                  channelUrl={me?.channel_url || ""}
                  channelBonusAmount={me?.channel_bonus_amount ?? 5}
                  channelBonusClaimed={
                    !!(me?.channel_bonus_claimed || me?.user.channel_bonus_claimed)
                  }
                  onClaimChannelBonus={async () => {
                    const res = await api.claimChannelBonus();
                    if (typeof res.trial_listings_left === "number") {
                      setMe((prev) =>
                        prev
                          ? {
                              ...prev,
                              channel_bonus_claimed:
                                res.already_claimed || res.bonus_granted || prev.channel_bonus_claimed,
                              user: {
                                ...prev.user,
                                trial_listings_left: res.trial_listings_left,
                                channel_bonus_claimed:
                                  res.already_claimed ||
                                  res.bonus_granted ||
                                  prev.user.channel_bonus_claimed,
                              },
                            }
                          : prev
                      );
                    }
                    return res;
                  }}
                  onNext={() => setOnboardStep((x) => Math.min(x + 1, ONBOARD_SLIDES.length - 1))}
                  onBack={() => setOnboardStep((x) => Math.max(0, x - 1))}
                  onFiltersCommit={commitOnboardingFilters}
                  onFinish={(params) => void finishOnboarding(params)}
                />
              );
            }
            if (s === "modePick") {
              const fromSettings = modePickFromSettings.current;
              return (
                <ModePickScreen
                  current={viewModeOf(me)}
                  changing={fromSettings}
                  onPick={(mode) => void pickViewMode(mode)}
                  onBack={fromSettings ? () => setScreen("settings") : undefined}
                />
              );
            }
            if (s === "browse") {
              return (
                <BrowseScreen
                  enabled={!!me?.active_filter}
                  ads={me?.ads}
                  onOutboundClick={openListingOutbound}
                  onEngage={(listing) => engageListing(listing.id)}
                  isPro={!!me?.has_subscription || !!me?.is_admin}
                  onUpgrade={() => void openTrialPaywall()}
                  onFavQuota={(count, max) =>
                    setMe((prev) => patchFavQuota(prev, count, max))
                  }
                />
              );
            }
            if (s === "settings") {
              return (
                <SettingsScreen
                  hasSubscription={!!me?.has_subscription}
                  isAdmin={!!me?.is_admin}
                  subscriptionUntil={me?.user.subscription_until}
                  swipesLeft={me?.swipes_left ?? me?.swipes_total ?? 30}
                  swipesTotal={me?.swipes_total ?? 30}
                  filtersCount={me?.filters?.length ?? 0}
                  viewMode={viewModeOf(me)}
                  theme={theme}
                  channelUrl={me?.channel_url || ""}
                  error={error}
                  onOpenSubscription={openSubscription}
                  onOpenFilters={() => setScreen("filters")}
                  onOpenViewMode={openViewModeSettings}
                  onOpenTheme={() => setThemePickerOpen(true)}
                  onOpenGuide={openOnboarding}
                  onOpenChannel={() => {
                    const url = me?.channel_url;
                    if (url) openExternalUrl(url);
                  }}
                />
              );
            }
            if (s === "subscription") {
              return (
                <SubscriptionScreen
                  priceRub={me?.subscription_price || 499}
                  stars={me?.subscription_stars || 80}
                  until={me?.user.subscription_until}
                  isAdmin={!!me?.is_admin}
                  onBack={() => setScreen("settings")}
                  onRenew={
                    me?.is_admin
                      ? undefined
                      : () => {
                          setPaywallMode("renew");
                          setScreen("paywall");
                        }
                  }
                />
              );
            }
            if (s === "filters") {
              return (
                <FiltersScreen
                  filters={me?.filters || []}
                  busy={busy}
                  error={error}
                  initialParams={filterDraft}
                  forceCreate={!me?.active_filter && !(me?.filters?.length)}
                  telegramParse={!!me?.features?.telegram_parse}
                  sourcesEnabled={me?.features?.sources}
                  sourcesShowcase={!!me?.features?.sources_showcase}
                  nlpQueryEnabled={me?.features?.nlp_query !== false}
                  isPro={!!me?.has_subscription || !!me?.is_admin}
                  onUpgrade={() => void openTrialPaywall()}
                  onBack={() => {
                    setFilterDraft(null);
                    setScreen("settings");
                  }}
                  onSave={async (params, opts) => {
                    setFilterDraft(null);
                    await saveFilters(params, opts);
                  }}
                  onActivate={(id) => void activateFilter(id)}
                  onDelete={(id) =>
                    void api
                      .deleteFilter(id)
                      .then(() => refreshMe())
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : "Не удалось удалить фильтр")
                      )
                  }
                  onNotifyChanged={() => void refreshMe()}
                />
              );
            }
            if (s === "waiting") {
              return (
                <WaitingScreen
                  status={taskStatus}
                  resultsCount={resultsCount}
                  failedSources={failedSources}
                  error={searchError}
                  onDismiss={() => {
                    setTaskId(null);
                    setScreen("filters");
                  }}
                  onRetry={() => {
                    if (me?.active_filter) {
                      void activateFilter(me.active_filter.id);
                    } else {
                      setScreen("filters");
                    }
                  }}
                />
              );
            }
            if (s === "deck") {
              return (
                <>
                  {error ? (
                    <div className="error" style={{ margin: "0 12px 8px" }}>
                      {error}
                    </div>
                  ) : null}
                  <DeckScreen
                    cards={cards}
                    canUndo={canUndo}
                    lastResultsCount={me?.last_task_results_count ?? 0}
                    isPro={!!me?.has_subscription || !!me?.is_admin}
                    onUpgrade={() => void openTrialPaywall()}
                    onSwipe={onSwipe}
                    onAdvanceDeck={onAdvanceDeck}
                    onUndo={onUndo}
                    onResetPasses={() =>
                      void onResetPasses().catch((e) =>
                        setError(e instanceof Error ? e.message : "Не удалось сбросить")
                      )
                    }
                    onEmptyFavorites={() => void openFavorites()}
                    onEditFilters={() => setScreen("filters")}
                    onOutboundClick={openListingOutbound}
                    onEngage={(listing) => engageListing(listing.id)}
                  />
                </>
              );
            }
            if (s === "favorites") {
              return (
                <>
                  {error ? (
                    <div className="error" style={{ margin: "0 12px 8px" }}>
                      {error}
                    </div>
                  ) : null}
                  <FavoritesScreen
                    items={favorites}
                    loading={favLoading}
                    sharing={sharing}
                    isPro={!!me?.has_subscription || !!me?.is_admin}
                    onUpgrade={() => void openTrialPaywall()}
                    onOutboundClick={openListingOutbound}
                    onEngage={(listing) => engageListing(listing.id)}
                    onShare={() => void onShare()}
                    onRemove={async (listingId) => {
                      setFavorites((prev) => prev.filter((f) => f.id !== listingId));
                      try {
                        await api.hideListing(listingId);
                        setCards((prev) => prev.filter((c) => c.id !== listingId));
                      } catch {
                        setFavorites(await api.favorites());
                        throw new Error("Не удалось скрыть");
                      }
                    }}
                    onUnfavorite={async (listingId) => {
                      setFavorites((prev) => prev.filter((f) => f.id !== listingId));
                      try {
                        const res = await api.removeFavorite(listingId);
                        setMe((prev) =>
                          patchFavQuota(prev, res.favorites_count, res.favorites_max)
                        );
                      } catch {
                        setFavorites(await api.favorites());
                        throw new Error("Не удалось убрать из избранного");
                      }
                    }}
                    onTogglePriceAlert={async (listingId, enabled) => {
                      await api.setFavoritePriceAlert(listingId, enabled);
                      setFavorites((prev) =>
                        prev.map((f) =>
                          f.id === listingId ? { ...f, notify_price_drop: enabled } : f
                        )
                      );
                    }}
                  />
                </>
              );
            }
            if (s === "paywall") {
              return (
                <PaywallScreen
                  priceRub={me?.subscription_price || 499}
                  stars={me?.subscription_stars || 80}
                  swipesLeft={me?.swipes_left ?? 0}
                  swipesTotal={me?.swipes_total ?? 30}
                  favoritesCount={me?.favorites_count ?? 0}
                  favoritesMax={me?.favorites_max ?? 5}
                  busy={payBusy}
                  busyMethod={payMethod}
                  error={error}
                  mode={paywallMode}
                  onPayStars={() => void onStarsPay()}
                  onPayTribute={() => onTributePay()}
                  onBack={() => setScreen(me?.has_subscription ? "subscription" : "settings")}
                />
              );
            }
            return null;
          }}
        </ScreenHost>
      </main>

      {!chromeHidden && !keyboardOpen ? (
        <nav className="bottom-nav" aria-label="Навигация">
          <button
            type="button"
            className={
              screen === "modePick" ||
              screen === "deck" ||
              screen === "browse" ||
              screen === "waiting"
                ? "active"
                : ""
            }
            disabled={!me?.active_filter}
            onClick={openSearchTab}
            aria-label="Поиск"
            title="Поиск"
          >
            <IconDiscover />
          </button>
          <button
            type="button"
            className={screen === "favorites" ? "active" : ""}
            disabled={!me?.active_filter}
            onClick={() => void openFavorites()}
            aria-label="Избранное"
            title="Избранное"
          >
            <IconFavorites />
          </button>
          <button
            type="button"
            className={
              screen === "settings" ||
              screen === "filters" ||
              screen === "subscription"
                ? "active"
                : ""
            }
            onClick={() => {
              setError(null);
              setScreen("settings");
            }}
            aria-label="Настройки"
            title="Настройки"
          >
            <IconSettings />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
