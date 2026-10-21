import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ListingDetailSheet } from "../components/ListingDetailSheet";
import { MediaImg } from "../components/MediaImg";
import { IconBack, IconFavorites, IconForward, IconHeartSlash, IconPriceDrop, IconSend } from "../icons";
import { sourceLabel, sourcesBadge } from "../lib/sources";
import type { ListingOut } from "../types";

type Props = {
  items: ListingOut[];
  loading?: boolean;
  sharing?: boolean;
  onShare: () => void;
  /** Hide listing permanently (swipe delete). */
  onRemove: (listingId: number) => Promise<void>;
  /** Remove from favorites only (heart in detail). */
  onUnfavorite?: (listingId: number) => Promise<void>;
  onTogglePriceAlert?: (listingId: number, enabled: boolean) => Promise<void>;
  isPro?: boolean;
  onUpgrade?: () => void;
  onOutboundClick?: (listing: ListingOut, url: string) => void | Promise<void>;
  onEngage?: (listing: ListingOut) => boolean | Promise<boolean>;
};

const MAX_DX = -100;
const OPEN_DX = -88;
const DELETE_THRESHOLD = -56;
const PAGE_SIZE = 5;

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function FavRow({
  item,
  onRemove,
  onTogglePriceAlert,
  onOpen,
}: {
  item: ListingOut;
  onRemove: (id: number) => Promise<void>;
  onTogglePriceAlert?: (listingId: number, enabled: boolean) => Promise<void>;
  onOpen: (item: ListingOut) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const badge = sourcesBadge(item);
  const startX = useRef(0);
  const startY = useRef(0);
  const dxRef = useRef(0);
  const dragging = useRef(false);
  const axis = useRef<"none" | "h" | "v">("none");
  const moved = useRef(false);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);

  function setOffset(value: number, animate: boolean) {
    const next = Math.min(0, Math.max(MAX_DX, value));
    dxRef.current = next;
    const el = itemRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    el.style.transform = `translateX(${next}px)`;
  }

  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (busy || removing) return;
    setBusy(true);
    setRemoving(true);
    setOffset(MAX_DX, true);
    await new Promise((r) => setTimeout(r, 280));
    try {
      await onRemove(item.id);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setRemoving(false);
      setOffset(0, true);
      setBusy(false);
    }
  }

  function endDrag() {
    if (!dragging.current && axis.current !== "h") {
      axis.current = "none";
      pointerId.current = null;
      return;
    }
    dragging.current = false;
    const wasH = axis.current === "h";
    axis.current = "none";
    pointerId.current = null;
    const el = itemRef.current;
    if (el) el.style.touchAction = "pan-y";

    if (!wasH) return;
    const current = dxRef.current;
    if (current <= DELETE_THRESHOLD) {
      void remove();
      return;
    }
    if (current <= OPEN_DX / 2) {
      setOffset(OPEN_DX, true);
      return;
    }
    setOffset(0, true);
  }

  function onPointerDown(e: PointerEvent) {
    if (busy) return;
    const t = e.target as HTMLElement;
    if (t.closest(".fav-actions, .fav-delete-btn")) return;
    // Mouse/pen: skip swipe capture so click opens the detail sheet.
    // Touch keeps swipe-to-hide; trash button works on all devices.
    if (e.pointerType === "mouse" || e.pointerType === "pen") return;
    dragging.current = true;
    moved.current = false;
    axis.current = "none";
    startX.current = e.clientX;
    startY.current = e.clientY;
    pointerId.current = e.pointerId;
    // Capture only after we know it's a horizontal swipe (see onPointerMove).
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    if (pointerId.current != null && e.pointerId !== pointerId.current) return;

    const mx = e.clientX - startX.current;
    const my = e.clientY - startY.current;

    if (axis.current === "none") {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      if (Math.abs(mx) >= Math.abs(my)) {
        axis.current = "h";
        const el = itemRef.current;
        if (el) el.style.touchAction = "none";
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else {
        axis.current = "v";
        dragging.current = false;
        return;
      }
    }
    if (axis.current !== "h") return;

    e.preventDefault();
    moved.current = true;
    setOffset(mx, false);
  }

  function openListing() {
    if (moved.current || Math.abs(dxRef.current) > 8) return;
    if (dxRef.current < -20) {
      setOffset(0, true);
      return;
    }
    onOpen(item);
  }

  return (
    <div className={`fav-swipe-wrap${removing ? " is-removing" : ""}`}>
      <div className="fav-swipe-bg">
        <button
          type="button"
          className="fav-delete-btn"
          disabled={busy}
          onClick={() => void remove()}
        >
          Скрыть
        </button>
      </div>
      <div
        ref={itemRef}
        className="fav-item"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button
          type="button"
          className="fav-item-link"
          onClick={(e) => {
            e.stopPropagation();
            openListing();
          }}
          onPointerDown={(e) => {
            // Keep mouse click free of parent swipe handlers.
            if (e.pointerType === "mouse" || e.pointerType === "pen") {
              e.stopPropagation();
            }
          }}
          draggable={false}
        >
          <div className="fav-thumb">
            {item.photos?.[0] ? (
              <MediaImg src={item.photos[0]} alt="" draggable={false} />
            ) : (
              <div className="fav-thumb-empty" />
            )}
          </div>
          <div className="info">
            <strong>
              {formatPrice(item.price)}
              {item.price_dropped && item.price_drop_amount ? (
                <span className="price-drop-pill">−{item.price_drop_amount.toLocaleString("ru-RU")} ₽</span>
              ) : null}
            </strong>
            <span className="muted">
              {badge || sourceLabel(item.source)}
              {item.area != null ? ` · ${item.area} м²` : ""}
              {item.floor != null
                ? ` · ${item.floor}${item.floors_total ? `/${item.floors_total}` : ""} эт.`
                : ""}
            </span>
            <span className="muted">
              {item.metro
                ? `${item.metro}${item.metro_walk_min != null ? ` · ${item.metro_walk_min} мин` : ""}`
                : "Метро не указано"}
            </span>
          </div>
        </button>
        <div className="fav-actions" onPointerDown={(e) => e.stopPropagation()}>
          {onTogglePriceAlert ? (
            <button
              type="button"
              className={`fav-action fav-alert${item.notify_price_drop !== false ? " on" : ""}`}
              disabled={alertBusy}
              title="Алерт о снижении цены"
              aria-label="Алерт о снижении цены"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAlertBusy(true);
                void onTogglePriceAlert(item.id, item.notify_price_drop === false)
                  .finally(() => setAlertBusy(false));
              }}
            >
              <IconPriceDrop size={17} />
            </button>
          ) : null}
          <button
            type="button"
            className="fav-action fav-trash"
            disabled={busy}
            aria-label="Скрыть объявление"
            title="Скрыть — больше не показывать"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void remove();
            }}
          >
            <IconHeartSlash size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function FavoritesScreen({
  items,
  loading,
  sharing,
  onShare,
  onRemove,
  onUnfavorite,
  onTogglePriceAlert,
  isPro = false,
  onUpgrade,
  onOutboundClick,
  onEngage,
}: Props) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ListingOut | null>(null);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages, items.length]);

  useEffect(() => {
    if (selected && !items.some((i) => i.id === selected.id)) {
      setSelected(null);
    }
  }, [items, selected]);

  if (loading && !items.length) {
    return (
      <div className="center screen-pane">
        <div className="spinner" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="center panel screen-pane">
        <div className="filter-empty-icon" aria-hidden>
          <IconFavorites size={28} />
        </div>
        <strong>Избранное пусто</strong>
        <p className="muted">Свайпните вправо, чтобы сохранить квартиру.</p>
      </div>
    );
  }

  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return (
    <div className="screen-pane fav-screen">
      <div className="fav-share-bar">
        <button className="btn primary block" type="button" disabled={sharing} onClick={onShare}>
          <IconSend size={18} />
          {sharing ? "Отправляем…" : "Отправить список в чат бота"}
        </button>
      </div>
      <div key={safePage} className={`fav-list view-fade${loading ? " is-loading" : ""}`}>
        {pageItems.map((item) => (
          <FavRow
            key={item.id}
            item={item}
            onRemove={onRemove}
            onTogglePriceAlert={onTogglePriceAlert}
            onOpen={setSelected}
          />
        ))}
      </div>
      {totalPages > 1 ? (
        <div className="fav-pager">
          <button
            type="button"
            className="btn fav-pager-btn"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Предыдущая страница"
          >
            <IconBack size={18} />
          </button>
          <span className="fav-pager-info">
            {safePage + 1} / {totalPages}
            <span className="muted"> · {items.length}</span>
          </span>
          <button
            type="button"
            className="btn fav-pager-btn"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Следующая страница"
          >
            <IconForward size={18} />
          </button>
        </div>
      ) : null}
      {selected ? (
        <ListingDetailSheet
          listing={selected}
          onClose={() => setSelected(null)}
          onToggleFav={async () => {
            if (onUnfavorite) await onUnfavorite(selected.id);
            else await onRemove(selected.id);
            setSelected(null);
          }}
          onOutboundClick={onOutboundClick}
          onEngage={onEngage}
          isPro={isPro}
          onUpgrade={onUpgrade}
        />
      ) : null}
    </div>
  );
}
