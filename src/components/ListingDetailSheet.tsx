import { useEffect, useRef, useState } from "react";
import { IconClose, IconExport, IconLike, IconMap, IconNote } from "../icons";
import { ListingDescription } from "./ListingDescription";
import { MoveInChip, SellerBadge } from "./MoveInCalc";
import { PhotoCrossfade } from "./PhotoCrossfade";
import { locationLabel, mapUrl } from "../lib/maps";
import { openExternalUrl } from "../lib/openUrl";
import { sourceLabel } from "../lib/sources";
import type { ListingOut } from "../types";

const CLOSE_MS = 320;
const DESC_CLOSE_MS = 240;

function formatPrice(n: number | null) {
  if (n == null) return "Цена не указана";
  return `${n.toLocaleString("ru-RU")} ₽`;
}

type Props = {
  listing: ListingOut;
  onClose: () => void;
  onToggleFav: () => Promise<void>;
  /** Trial-gated outbound to aggregator. */
  onOutboundClick?: (listing: ListingOut, url: string) => void | Promise<void>;
  /** Trial engage before «Описание». */
  onEngage?: (listing: ListingOut) => boolean | Promise<boolean>;
  isPro?: boolean;
  onUpgrade?: () => void;
};

export function ListingDetailSheet({
  listing,
  onClose,
  onToggleFav,
  onOutboundClick,
  onEngage,
  isPro = false,
  onUpgrade,
}: Props) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [descClosing, setDescClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const descCloseTimer = useRef(0);

  const photos = listing.photos?.length ? listing.photos : [""];
  const map = mapUrl(listing);

  useEffect(() => {
    setPhotoIdx(0);
    setDescOpen(false);
    setDescClosing(false);
    setClosing(false);
    return () => window.clearTimeout(descCloseTimer.current);
  }, [listing.id]);

  function closeDesc() {
    if (!descOpen || descClosing) return;
    setDescClosing(true);
    window.clearTimeout(descCloseTimer.current);
    descCloseTimer.current = window.setTimeout(() => {
      setDescOpen(false);
      setDescClosing(false);
    }, DESC_CLOSE_MS);
  }

  function finishClose() {
    if (closing) return;
    setClosing(true);
    setDescOpen(false);
    setDescClosing(false);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    window.setTimeout(onClose, CLOSE_MS);
  }

  function onPhotoTap(dir: -1 | 1) {
    if (photos.length <= 1) return;
    setPhotoIdx((i) => (i + dir + photos.length) % photos.length);
  }

  async function toggleFav() {
    if (busy) return;
    setBusy(true);
    try {
      await onToggleFav();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`listing-detail${closing ? " listing-detail--out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Карточка объявления"
    >
      <button
        type="button"
        className="listing-detail-backdrop"
        aria-label="Закрыть"
        onClick={finishClose}
      />
      <div className={`listing-detail-sheet card${descOpen ? " has-desc" : ""}`}>
        <button
          type="button"
          className="listing-detail-close"
          aria-label="Закрыть"
          tabIndex={descOpen ? -1 : 0}
          onClick={finishClose}
        >
          <IconClose size={16} />
        </button>

        <div className="card-media">
          {photos.length > 1 ? (
            <div className="photo-dots">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`photo-dot${i === photoIdx ? " on" : ""}`}
                  aria-label={`Фото ${i + 1}`}
                  aria-current={i === photoIdx}
                  onClick={() => setPhotoIdx(i)}
                />
              ))}
            </div>
          ) : null}
          {photos[photoIdx] ? (
            <PhotoCrossfade key={listing.id} src={photos[photoIdx]} />
          ) : (
            <div className="listing-detail-nophoto">Нет фото</div>
          )}
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                className="photo-tap photo-tap-left"
                aria-label="Предыдущее фото"
                onClick={() => onPhotoTap(-1)}
              />
              <button
                type="button"
                className="photo-tap photo-tap-right"
                aria-label="Следующее фото"
                onClick={() => onPhotoTap(1)}
              />
            </>
          ) : null}
          <div className="card-gradient" />
        </div>

        <div className="card-body">
          <div className="card-info">
            <div className="price-row">
              <div className="price">{formatPrice(listing.price)}</div>
              {isPro ? <SellerBadge listing={listing} /> : null}
            </div>
            {listing.source === "telegram" && (listing.title || listing.description_rewritten) ? (
              <div className="meta meta-teaser">
                {(listing.title || listing.description_rewritten || "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 110)}
              </div>
            ) : null}
            <div className="meta">
              {[
                sourceLabel(listing.source),
                listing.rooms == null
                  ? null
                  : listing.rooms === 0
                    ? "студия"
                    : `${listing.rooms}-комн.`,
                listing.area != null ? `${listing.area} м²` : null,
                listing.floor != null
                  ? `${listing.floor}${listing.floors_total ? `/${listing.floors_total}` : ""} эт.`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {listing.metro ? (
              <div className="meta">
                м. {listing.metro}
                {listing.metro_walk_min != null ? ` · ${listing.metro_walk_min} мин` : ""}
              </div>
            ) : null}
            {listing.source === "telegram" && locationLabel(listing) ? (
              <div className="meta">{locationLabel(listing)}</div>
            ) : null}
          </div>

          <div className="card-links">
            <button
              type="button"
              className="card-chip"
              onClick={(e) => {
                e.stopPropagation();
                void (async () => {
                  if (onEngage) {
                    const ok = await onEngage(listing);
                    if (!ok) return;
                  }
                  setDescOpen(true);
                })();
              }}
            >
              <IconNote size={14} />
              Описание
            </button>
            <button
              type="button"
              className="card-chip"
              onClick={(e) => {
                e.stopPropagation();
                if (!listing.url) return;
                if (onOutboundClick) void onOutboundClick(listing, listing.url);
                else openExternalUrl(listing.url);
              }}
            >
              <IconExport size={14} />
              Объявление
            </button>
            {map ? (
              <button
                type="button"
                className="card-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  openExternalUrl(map);
                }}
              >
                <IconMap size={14} />
                На карте
              </button>
            ) : null}
            <MoveInChip listing={listing} isPro={isPro} onUpgrade={onUpgrade} />
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
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!s.url) return;
                    if (onOutboundClick) void onOutboundClick(listing, s.url);
                    else openExternalUrl(s.url);
                  }}
                >
                  {sourceLabel(s.source)}
                </button>
              ))}
          </div>

          <div className="actions-dock in-card">
            <div className="actions-glass">
              <button
                className={`fab fab-lg like${listing.is_favorite ? " on" : ""}`}
                type="button"
                disabled={busy}
                aria-label={listing.is_favorite ? "Убрать из избранного" : "В избранное"}
                onClick={() => void toggleFav()}
              >
                <IconLike size={18} />
              </button>
            </div>
          </div>
        </div>

        {descOpen ? (
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
                aria-label="Закрыть описание"
                onClick={closeDesc}
              >
                <IconClose size={14} />
              </button>
            </div>
            <div className="desc-sheet-body">
              <ListingDescription listing={listing} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
