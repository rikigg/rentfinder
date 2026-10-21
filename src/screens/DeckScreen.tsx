import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  IconClose,
  IconEdit,
  IconExport,
  IconFavorites,
  IconLike,
  IconMap,
  IconNote,
  IconPass,
  IconRefresh,
  IconUndo,
} from "../icons";
import { ListingDescription } from "../components/ListingDescription";
import { MoveInChip, SellerBadge } from "../components/MoveInCalc";
import { MediaImg } from "../components/MediaImg";
import { PhotoCrossfade } from "../components/PhotoCrossfade";
import { locationLabel, mapUrl } from "../lib/maps";
import { prefetchMedia } from "../lib/media";
import { openExternalUrl } from "../lib/openUrl";
import { sourceLabel } from "../lib/sources";
import { isAdCard, type AdCard, type DeckCard, type ListingOut } from "../types";

type Props = {
  cards: DeckCard[];
  canUndo: boolean;
  /** Results from last parse; 0 → show «нет объявлений», not «всё просмотрено». */
  lastResultsCount?: number;
  isPro?: boolean;
  onUpgrade?: () => void;
  /** API call only — does not shift the deck. */
  onSwipe: (card: DeckCard, direction: "left" | "right") => Promise<void>;
  /** Remove card after fly animation finishes. */
  onAdvanceDeck: (cardId: number | string) => void;
  onUndo: () => Promise<void>;
  onResetPasses: () => Promise<void>;
  onEmptyFavorites: () => void;
  onEditFilters: () => void;
  /** Outbound to aggregator (кнопка «Объявление» / чипы площадок). */
  onOutboundClick?: (listing: ListingOut, url: string) => void | Promise<void>;
  /** Trial engage before «Описание» — return false to block. */
  onEngage?: (listing: ListingOut) => boolean | Promise<boolean>;
};

type LeaveState = {
  listing: DeckCard;
  direction: "left" | "right";
  photoIdx: number;
  startDx: number;
};

const FLY_MS = 320;
const ENTER_MS = 500;
const SNAP_MS = 220;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Stamp / commit threshold — haptic arms here; fly commits slightly higher. */
const STAMP_PX = 110;
const STAMP_HAPTIC_PX = 80;

function formatPrice(n: number | null) {
  if (n == null) return "Цена не указана";
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function applyCardTransform(
  el: HTMLElement | null,
  dx: number,
  animateMs: number | null,
  opacity = 1
) {
  if (!el) return;
  const rot = dx / 28;
  el.style.transition =
    animateMs != null
      ? `transform ${animateMs}ms ${EASE}, opacity ${animateMs}ms ${EASE}`
      : "none";
  el.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  el.style.opacity = String(opacity);
}

function applyStamps(
  likeEl: HTMLElement | null,
  passEl: HTMLElement | null,
  dx: number
) {
  if (likeEl) likeEl.style.opacity = String(Math.min(1, Math.max(0, dx / 120)));
  if (passEl) passEl.style.opacity = String(Math.min(1, Math.max(0, -dx / 120)));
}

/** Green/red edge glow strength 0–1 from drag distance (Studio Dark). */
function applySwipeBleed(el: HTMLElement | null, dx: number) {
  if (!el) return;
  const t = Math.min(1, Math.abs(dx) / STAMP_PX);
  if (t < 0.03) {
    el.style.removeProperty("--swipe-t");
    el.classList.remove("is-swipe-like", "is-swipe-pass");
    return;
  }
  el.style.setProperty("--swipe-t", t.toFixed(3));
  if (dx > 0) {
    el.classList.add("is-swipe-like");
    el.classList.remove("is-swipe-pass");
  } else {
    el.classList.add("is-swipe-pass");
    el.classList.remove("is-swipe-like");
  }
}

function clearSwipeBleed(el: HTMLElement | null) {
  if (!el) return;
  el.style.removeProperty("--swipe-t");
  el.classList.remove("is-swipe-like", "is-swipe-pass");
}

function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
}

function hapticNotify(type: "success" | "error" | "warning") {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
}

function roomsShort(rooms: number | null | undefined): string | null {
  if (rooms == null) return null;
  if (rooms === 0) return "студия";
  return `${rooms}-комн.`;
}

function CardMeta({ listing, isPro }: { listing: ListingOut; isPro?: boolean }) {
  const rooms = roomsShort(listing.rooms);
  const facts = [
    sourceLabel(listing.source),
    rooms,
    listing.area != null ? `${listing.area} м²` : null,
    listing.floor != null
      ? `${listing.floor}${listing.floors_total ? `/${listing.floors_total}` : ""} эт.`
      : null,
  ].filter(Boolean);
  const teaser =
    listing.source === "telegram"
      ? (listing.title || listing.description_rewritten || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 110)
      : "";

  return (
    <>
      <div className="price-row">
        <div className="price">{formatPrice(listing.price)}</div>
        {isPro ? <SellerBadge listing={listing} /> : null}
      </div>
      {teaser ? <div className="meta meta-teaser">{teaser}</div> : null}
      <div className="meta">{facts.join(" · ")}</div>
      {listing.metro ? (
        <div className="meta">
          м. {listing.metro}
          {listing.metro_walk_min != null ? ` · ${listing.metro_walk_min} мин` : ""}
        </div>
      ) : null}
      {listing.source === "telegram" && locationLabel(listing) ? (
        <div className="meta">{locationLabel(listing)}</div>
      ) : null}
    </>
  );
}

function AdCardFace({
  ad,
  interactive,
  busy,
  likeStampRef,
  passStampRef,
  onPass,
  onLike,
}: {
  ad: AdCard;
  interactive: boolean;
  busy?: boolean;
  likeStampRef?: RefObject<HTMLDivElement | null>;
  passStampRef?: RefObject<HTMLDivElement | null>;
  onPass?: () => void;
  onLike?: () => void;
}) {
  return (
    <>
      {interactive ? (
        <>
          <div className="stamp like" ref={likeStampRef}>
            ДА
          </div>
          <div className="stamp pass" ref={passStampRef}>
            НЕТ
          </div>
        </>
      ) : null}

      <div className="card-media card-media-ad">
        <span className="ad-badge">Реклама</span>
        {ad.image_url ? (
          interactive ? (
            <PhotoCrossfade key={ad.id} src={ad.image_url} />
          ) : (
            <MediaImg src={ad.image_url} alt="" draggable={false} decoding="async" />
          )
        ) : (
          <div className="listing-detail-nophoto">Нет фото</div>
        )}
        <div className="card-gradient" />
      </div>

      <div className="card-body card-body-ad">
        <div className="card-info">
          <div className="price">Реклама</div>
          <div className="meta muted">Смахните, чтобы продолжить</div>
        </div>
        {ad.click_url && interactive ? (
          <div className="card-links">
            <button
              type="button"
              className="card-chip"
              onClick={(e) => {
                e.stopPropagation();
                openExternalUrl(ad.click_url!);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <IconExport size={14} />
              Открыть
            </button>
          </div>
        ) : null}
        <div className="actions-dock in-card" onPointerDown={(e) => e.stopPropagation()}>
          <div className="actions-glass">
            <button
              className="fab fab-lg pass"
              type="button"
              disabled={!interactive || busy}
              aria-label="Дальше"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && onPass?.()}
            >
              <IconPass size={18} />
            </button>
            <button
              className="fab fab-lg like"
              type="button"
              disabled={!interactive || busy}
              aria-label="Дальше"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && onLike?.()}
            >
              <IconLike size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Full card face — always complete (photo + meta + chips + dock). */
function CardFace({
  listing,
  photoIdx = 0,
  interactive,
  canUndo,
  busy,
  isPro,
  onUpgrade,
  likeStampRef,
  passStampRef,
  onPhotoTap,
  onPhotoGo,
  onOpenDesc,
  onOutboundClick,
  onUndo,
  onPass,
  onLike,
  descSlot,
}: {
  listing: ListingOut;
  photoIdx?: number;
  interactive: boolean;
  canUndo?: boolean;
  busy?: boolean;
  isPro?: boolean;
  onUpgrade?: () => void;
  likeStampRef?: RefObject<HTMLDivElement | null>;
  passStampRef?: RefObject<HTMLDivElement | null>;
  onPhotoTap?: (dir: -1 | 1) => void;
  onPhotoGo?: (index: number) => void;
  onOpenDesc?: () => void;
  onOutboundClick?: (listing: ListingOut, url: string) => void | Promise<void>;
  onUndo?: () => void;
  onPass?: () => void;
  onLike?: () => void;
  descSlot?: ReactNode;
}) {
  const photos = listing.photos?.length ? listing.photos : [""];
  const map = mapUrl(listing);
  const safeIdx = Math.max(0, Math.min(photoIdx, photos.length - 1));
  const src = photos[safeIdx] || "";

  return (
    <>
      {interactive ? (
        <>
          <div className="stamp like" ref={likeStampRef}>
            ДА
          </div>
          <div className="stamp pass" ref={passStampRef}>
            НЕТ
          </div>
        </>
      ) : null}

      <div className="card-media">
        {photos.length > 1 && interactive ? (
          <div
            className="photo-dots"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`photo-dot${i === photoIdx ? " on" : ""}`}
                aria-label={`Фото ${i + 1}`}
                aria-current={i === photoIdx}
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoGo?.(i);
                }}
              />
            ))}
          </div>
        ) : null}
        {src ? (
          interactive ? (
            <PhotoCrossfade key={listing.id} src={src} />
          ) : (
            <MediaImg src={src} alt="" draggable={false} decoding="async" />
          )
        ) : (
          <div className="listing-detail-nophoto">Нет фото</div>
        )}
        {interactive && photos.length > 1 ? (
          <>
            {/* Hit zones only — step on card pointerup (no onClick: would double-step) */}
            <button
              type="button"
              className="photo-tap photo-tap-left"
              aria-label="Предыдущее фото"
              tabIndex={-1}
            />
            <button
              type="button"
              className="photo-tap photo-tap-right"
              aria-label="Следующее фото"
              tabIndex={-1}
            />
          </>
        ) : null}
        <div className="card-gradient" />
      </div>

      <div className="card-body">
        <div className="card-info">
          <CardMeta listing={listing} isPro={isPro} />
        </div>

        <div className="card-links">
          <button
            type="button"
            className="card-chip"
            tabIndex={interactive ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              if (interactive) onOpenDesc?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconNote size={14} />
            Описание
          </button>
          <button
            type="button"
            className="card-chip"
            tabIndex={interactive ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              if (!interactive || !listing.url) return;
              if (onOutboundClick) void onOutboundClick(listing, listing.url);
              else openExternalUrl(listing.url);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconExport size={14} />
            Объявление
          </button>
          {map ? (
            <button
              type="button"
              className="card-chip"
              tabIndex={interactive ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                if (interactive) openExternalUrl(map);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <IconMap size={14} />
              На карте
            </button>
          ) : null}
          <MoveInChip
            listing={listing}
            isPro={!!isPro}
            interactive={interactive}
            onUpgrade={onUpgrade}
          />
          {(listing.source_urls || [])
            .filter(
              (s) =>
                s.url !== listing.url &&
                s.source !== "telegram" &&
                s.source !== listing.source
            )
            .slice(0, 3)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className="card-chip"
                tabIndex={interactive ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!interactive || !s.url) return;
                  if (onOutboundClick) void onOutboundClick(listing, s.url);
                  else openExternalUrl(s.url);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {sourceLabel(s.source)}
              </button>
            ))}
        </div>

        <div className="actions-dock in-card" onPointerDown={(e) => e.stopPropagation()}>
          <div className="actions-glass">
            <button
              className="fab fab-lg undo"
              type="button"
              disabled={!interactive || !canUndo || busy}
              aria-label="Отменить"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && onUndo?.()}
            >
              <IconUndo size={18} />
            </button>
            <button
              className="fab fab-lg pass"
              type="button"
              disabled={!interactive || busy}
              aria-label="Пропустить"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && onPass?.()}
            >
              <IconPass size={18} />
            </button>
            <button
              className="fab fab-lg like"
              type="button"
              disabled={!interactive || busy}
              aria-label="В избранное"
              tabIndex={interactive ? 0 : -1}
              onClick={() => interactive && onLike?.()}
            >
              <IconLike size={18} />
            </button>
          </div>
        </div>
      </div>

      {descSlot}
    </>
  );
}

export function DeckScreen({
  cards,
  canUndo,
  lastResultsCount = 0,
  isPro = false,
  onUpgrade,
  onSwipe,
  onAdvanceDeck,
  onUndo,
  onResetPasses,
  onEmptyFavorites,
  onEditFilters,
  onOutboundClick,
  onEngage,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [descClosing, setDescClosing] = useState(false);
  const [leave, setLeave] = useState<LeaveState | null>(null);
  const [entering, setEntering] = useState(false);
  /** Side the next card slides in from (opposite of swipe). */
  const [enterFrom, setEnterFrom] = useState<"left" | "right">("left");
  const descCloseTimer = useRef(0);
  const enterTimer = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const dxRef = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  /** Tap started on photo area — step photo on pointerup if drag didn't move. */
  const tapOnPhoto = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const leaveRef = useRef<HTMLDivElement | null>(null);
  const likeStampRef = useRef<HTMLDivElement | null>(null);
  const passStampRef = useRef<HTMLDivElement | null>(null);
  const leaveLikeRef = useRef<HTMLDivElement | null>(null);
  const leavePassRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  /** Which stamp side already fired light impact this drag. */
  const stampHapticSide = useRef<"left" | "right" | null>(null);

  const current = cards[0];
  const next = cards[1];

  function closeDesc() {
    if (!descOpen || descClosing) return;
    setDescClosing(true);
    window.clearTimeout(descCloseTimer.current);
    descCloseTimer.current = window.setTimeout(() => {
      setDescOpen(false);
      setDescClosing(false);
    }, 240);
  }

  useEffect(() => {
    setPhotoIdx(0);
    setDescOpen(false);
    setDescClosing(false);
    dxRef.current = 0;
    stampHapticSide.current = null;
    applyStamps(likeStampRef.current, passStampRef.current, 0);
    clearSwipeBleed(cardRef.current);

    const el = cardRef.current;
    // Always clear leftover inline opacity from the previous fly-out.
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    }

    // While appear animation runs, do not stomp transform/opacity with inline styles.
    if (entering) return;

    applyCardTransform(cardRef.current, 0, null, 1);
  }, [current?.id, entering]);

  useEffect(() => {
    if (!next) return;
    const url = isAdCard(next) ? next.image_url : next.photos?.[0];
    prefetchMedia(url);
  }, [next]);

  // Prefetch every photo of the active card (+ next card cover)
  useEffect(() => {
    if (!current || isAdCard(current)) return;
    for (const url of current.photos || []) prefetchMedia(url);
  }, [current]);

  useEffect(() => {
    if (!current || isAdCard(current)) return;
    const photos = current.photos || [];
    if (photos.length <= 1) return;
    const n = photos.length;
    for (const i of [(photoIdx + 1) % n, (photoIdx + 2) % n]) {
      prefetchMedia(photos[i]);
    }
  }, [current, photoIdx]);

  useLayoutEffect(() => {
    if (!leave || !leaveRef.current) return;
    const el = leaveRef.current;
    const leaveDx = leave.direction === "right" ? 200 : -200;
    applyCardTransform(el, leave.startDx, null, 1);
    applyStamps(leaveLikeRef.current, leavePassRef.current, leaveDx);
    applySwipeBleed(el, leaveDx);
    const fly =
      leave.direction === "right" ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        applyCardTransform(el, fly, FLY_MS, 0);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [leave]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(descCloseTimer.current);
      window.clearTimeout(enterTimer.current);
    };
  }, []);

  async function commit(direction: "left" | "right") {
    // Only lock while a card is flying out — never wait on API for photo taps
    if (!current || busy || leave) return;
    setBusy(true);
    dragging.current = false;
    setDescOpen(false);
    setDescClosing(false);
    setEntering(false);

    const startDx = dxRef.current;
    const swiped = current;
    const swipedPhoto = photoIdx;
    const hasNext = Boolean(next);
    const nextFrom: "left" | "right" = direction === "right" ? "left" : "right";

    setLeave({
      listing: swiped,
      direction,
      photoIdx: swipedPhoto,
      startDx,
    });
    dxRef.current = 0;
    stampHapticSide.current = null;
    applyCardTransform(cardRef.current, 0, null, 0);
    clearSwipeBleed(cardRef.current);
    // Fly-away: success = like, error = pass
    hapticNotify(direction === "right" ? "success" : "error");

    let swipePromise: Promise<void>;
    try {
      swipePromise = onSwipe(swiped, direction);
    } catch {
      setLeave(null);
      applyCardTransform(cardRef.current, 0, SNAP_MS, 1);
      applyStamps(likeStampRef.current, passStampRef.current, 0);
      clearSwipeBleed(cardRef.current);
      setBusy(false);
      return;
    }

    try {
      await new Promise((r) => setTimeout(r, FLY_MS));
      window.clearTimeout(enterTimer.current);
      if (hasNext) {
        setEnterFrom(nextFrom);
        setEntering(true);
        enterTimer.current = window.setTimeout(() => setEntering(false), ENTER_MS);
      }
      onAdvanceDeck(swiped.id);
      setLeave(null);
      setPhotoIdx(0);
      applyStamps(likeStampRef.current, passStampRef.current, 0);
      clearSwipeBleed(cardRef.current);
      // Unlock immediately — photo flip works during enter anim; API runs in bg
      setBusy(false);
      void swipePromise.catch(() => {
        /* swipe persistence errors are handled upstream */
      });
    } catch {
      setEntering(false);
      applyCardTransform(cardRef.current, 0, SNAP_MS, 1);
      applyStamps(likeStampRef.current, passStampRef.current, 0);
      clearSwipeBleed(cardRef.current);
      setLeave(null);
      setBusy(false);
    }
  }

  function stepPhoto(dir: -1 | 1) {
    if (leave || !current || isAdCard(current)) return;
    const photos = current.photos || [];
    if (photos.length <= 1) return;
    const n = photos.length;
    setPhotoIdx((i) => (i + dir + n) % n);
  }

  function goPhoto(index: number) {
    if (leave || !current || isAdCard(current)) return;
    const photos = current.photos || [];
    if (photos.length <= 1) return;
    setPhotoIdx(Math.max(0, Math.min(photos.length - 1, index)));
  }

  function onPointerDown(e: PointerEvent) {
    // Block only while the flyer is mid-air — not during API / enter anim
    if (leave) return;
    if (document.documentElement.classList.contains("move-in-open")) return;
    if (document.documentElement.classList.contains("pro-lock-open")) return;
    const t = e.target as HTMLElement;
    if (
      t.closest(
        "a,button.card-chip,button.photo-dot,.photo-dots,.actions-dock,.desc-sheet"
      )
    ) {
      return;
    }
    tapOnPhoto.current = !!t.closest(".card-media, .photo-tap");
    dragging.current = true;
    moved.current = false;
    stampHapticSide.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dxRef.current = 0;
    // Don't fight CSS enter animation with inline transform
    if (!entering) {
      applyCardTransform(cardRef.current, 0, null, 1);
      clearSwipeBleed(cardRef.current);
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 8) moved.current = true;
    // During enter anim: track for photo-tap, but don't drag the card
    if (entering || busy) {
      dxRef.current = 0;
      return;
    }
    dxRef.current = d;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const dx = dxRef.current;
      applyCardTransform(cardRef.current, dx, null, 1);
      applyStamps(likeStampRef.current, passStampRef.current, dx);
      applySwipeBleed(cardRef.current, dx);

      const side =
        dx > STAMP_HAPTIC_PX ? "right" : dx < -STAMP_HAPTIC_PX ? "left" : null;
      if (side && stampHapticSide.current !== side) {
        stampHapticSide.current = side;
        hapticImpact("medium");
      } else if (!side) {
        stampHapticSide.current = null;
      }
    });
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = dxRef.current;
    const onPhoto = tapOnPhoto.current;
    tapOnPhoto.current = false;

    const canSwipeCard = !busy && !entering && !leave;
    if (canSwipeCard && dx > STAMP_PX) {
      void commit("right");
      return;
    }
    if (canSwipeCard && dx < -STAMP_PX) {
      void commit("left");
      return;
    }

    if (!entering && !leave) {
      applyCardTransform(cardRef.current, 0, SNAP_MS, 1);
      applyStamps(likeStampRef.current, passStampRef.current, 0);
      clearSwipeBleed(cardRef.current);
    }
    stampHapticSide.current = null;
    dxRef.current = 0;

    // Photo step always allowed (except mid-fly)
    if (!moved.current && Math.abs(dx) <= 8 && onPhoto && !leave) {
      const media = cardRef.current?.querySelector(".card-media");
      const rect = media?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        const yRel = startY.current - rect.top;
        if (yRel >= 0 && yRel < rect.height * 0.68) {
          const dir: -1 | 1 =
            startX.current < rect.left + rect.width / 2 ? -1 : 1;
          stepPhoto(dir);
        }
      }
    }
  }

  function onPhotoTap(dir: -1 | 1) {
    stepPhoto(dir);
  }

  if (!current && !leave) {
    const noListings = lastResultsCount <= 0;
    return (
      <div className="center panel screen-pane">
        <strong>
          {noListings ? "Пока нет актуальных объявлений" : "Пока всё просмотрено"}
        </strong>
        <p className="muted">
          {noListings
            ? "Парсеры ничего не нашли по этому фильтру. Попробуйте изменить параметры или запустить поиск позже."
            : "Новые объявления подтянем примерно раз в 5 часов. Можно вернуть отказы или поменять фильтр."}
        </p>
        {!noListings ? (
          <button className="btn primary block" type="button" onClick={() => void onResetPasses()}>
            <IconRefresh size={18} />
            Показать отказы снова
          </button>
        ) : null}
        <button
          className={`btn ${noListings ? "primary" : ""} block`}
          type="button"
          onClick={onEditFilters}
        >
          <IconEdit size={18} />
          {noListings ? "Изменить фильтр и искать" : "Изменить фильтр"}
        </button>
        {!noListings ? (
          <button className="btn block" type="button" onClick={onEmptyFavorites}>
            <IconFavorites size={18} />
            Открыть избранное
          </button>
        ) : null}
        {canUndo ? (
          <button className="btn block" type="button" onClick={() => void onUndo()}>
            <IconUndo size={18} />
            Вернуть последнюю
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="deck-wrap screen-pane">
      <div className={`deck${leave ? " is-flying" : ""}${entering ? " is-entering" : ""}`}>
        {/* Silhouette under-card — depth only, no second photo */}
        {next ? <div className="card-back" aria-hidden /> : null}

        {current ? (
          <div
            key={current.id}
            ref={cardRef}
            className={`card${isAdCard(current) ? " card-ad" : ""}${
              leave ? " card-under-fly" : ""
            }${entering ? ` card-enter card-enter-from-${enterFrom}` : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Outer .card = shadow/transform; .card-face clips photo */}
            <div className="card-face">
              {isAdCard(current) ? (
                <AdCardFace
                  ad={current}
                  interactive
                  busy={busy}
                  likeStampRef={likeStampRef}
                  passStampRef={passStampRef}
                  onPass={() => void commit("left")}
                  onLike={() => void commit("right")}
                />
              ) : (
                <CardFace
                  listing={current}
                  photoIdx={photoIdx}
                  interactive
                  canUndo={canUndo}
                  busy={busy}
                  isPro={isPro}
                  onUpgrade={onUpgrade}
                  likeStampRef={likeStampRef}
                  passStampRef={passStampRef}
                  onPhotoTap={onPhotoTap}
                  onPhotoGo={goPhoto}
                  onOpenDesc={() => {
                    void (async () => {
                      if (onEngage) {
                        const ok = await onEngage(current);
                        if (!ok) return;
                      }
                      setDescOpen(true);
                    })();
                  }}
                  onOutboundClick={onOutboundClick}
                  onUndo={() => void onUndo()}
                  onPass={() => void commit("left")}
                  onLike={() => void commit("right")}
                  descSlot={
                    descOpen ? (
                      <div
                        className={`desc-sheet${descClosing ? " desc-sheet--out" : ""}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="desc-sheet-head">
                          <strong>Описание</strong>
                          <button
                            type="button"
                            className="desc-sheet-close"
                            aria-label="Закрыть"
                            onClick={closeDesc}
                          >
                            <IconClose size={14} />
                          </button>
                        </div>
                        <div className="desc-sheet-body">
                          <ListingDescription listing={current} />
                        </div>
                      </div>
                    ) : null
                  }
                />
              )}
            </div>
          </div>
        ) : null}

        {leave ? (
          <div
            ref={leaveRef}
            className={`card card-leaving${isAdCard(leave.listing) ? " card-ad" : ""}`}
            style={{
              transform: `translateX(${leave.startDx}px) rotate(${leave.startDx / 28}deg)`,
            }}
          >
            <div className="card-face">
              <div className="stamp like" ref={leaveLikeRef} style={{ opacity: 1 }}>
                ДА
              </div>
              <div className="stamp pass" ref={leavePassRef} style={{ opacity: 1 }}>
                НЕТ
              </div>
              {isAdCard(leave.listing) ? (
                <AdCardFace ad={leave.listing} interactive={false} />
              ) : (
                <CardFace
                  listing={leave.listing}
                  photoIdx={leave.photoIdx}
                  interactive={false}
                  isPro={isPro}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
