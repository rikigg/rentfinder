import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ListingDetailSheet } from "../components/ListingDetailSheet";
import { MediaImg } from "../components/MediaImg";
import { openExternalUrl } from "../lib/openUrl";
import { renovationBadge } from "../lib/renovation";
import { sourceLabel, sourcesBadge } from "../lib/sources";
import type { AdsCampaign, ListingOut } from "../types";

type Props = {
  enabled?: boolean;
  ads?: AdsCampaign | null;
  /** Trial-gated outbound to aggregator from detail sheet. */
  onOutboundClick?: (listing: ListingOut, url: string) => void | Promise<void>;
  /** Trial engage before «Описание». */
  onEngage?: (listing: ListingOut) => boolean | Promise<boolean>;
  isPro?: boolean;
  onUpgrade?: () => void;
  /** Keep App `me.favorites_count` in sync after browse fav toggles. */
  onFavQuota?: (count?: number, max?: number | null) => void;
};

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function BrowseRow({
  item,
  onOpen,
  onToggleFav,
  onHide,
}: {
  item: ListingOut;
  onOpen: (item: ListingOut) => void;
  onToggleFav: (item: ListingOut) => Promise<void>;
  onHide: (item: ListingOut) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <article className="browse-item">
      <button type="button" className="browse-main" onClick={() => onOpen(item)}>
        <div className="browse-thumb">
          {item.photos?.[0] ? (
            <MediaImg src={item.photos[0]} alt="" loading="lazy" />
          ) : (
            <div className="browse-thumb-empty" />
          )}
        </div>
        <div className="browse-info">
          <strong>{formatPrice(item.price)}</strong>
          <span className="muted">
            {sourcesBadge(item) || sourceLabel(item.source)}
            {item.rooms != null ? ` · ${item.rooms === 0 ? "студия" : `${item.rooms}к`}` : ""}
            {item.area != null ? ` · ${item.area} м²` : ""}
            {renovationBadge(item.renovation) ? ` · ${renovationBadge(item.renovation)}` : ""}
          </span>
          <span className="muted">
            {item.metro ? `🚇 ${item.metro}` : item.address || item.title || "—"}
          </span>
        </div>
      </button>
      <div className="browse-actions">
        <button
          type="button"
          className="browse-hide"
          disabled={busy}
          aria-label="Скрыть объявление"
          title="Скрыть — больше не показывать"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBusy(true);
            void onHide(item).finally(() => setBusy(false));
          }}
        >
          ✕
        </button>
        <button
          type="button"
          className={`browse-fav${item.is_favorite ? " on" : ""}`}
          disabled={busy}
          aria-label={item.is_favorite ? "Убрать из избранного" : "В избранное"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBusy(true);
            void onToggleFav(item).finally(() => setBusy(false));
          }}
        >
          {item.is_favorite ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}

export function BrowseScreen({
  enabled = true,
  ads = null,
  onOutboundClick,
  onEngage,
  isPro = false,
  onUpgrade,
  onFavQuota,
}: Props) {
  const [items, setItems] = useState<ListingOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ListingOut | null>(null);
  const offsetRef = useRef(0);

  function openItem(item: ListingOut) {
    setSelected(item);
  }

  async function load(reset: boolean) {
    if (!enabled) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const res = await api.browse(30, reset ? 0 : offsetRef.current);
      setTotal(res.total);
      setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
      offsetRef.current = (reset ? 0 : offsetRef.current) + res.items.length;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить ленту");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, [enabled]);

  async function toggleFav(item: ListingOut) {
    try {
      if (item.is_favorite) {
        const res = await api.removeFavorite(item.id);
        onFavQuota?.(res.favorites_count, res.favorites_max);
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, is_favorite: false } : x))
        );
        setSelected((cur) =>
          cur?.id === item.id ? { ...cur, is_favorite: false } : cur
        );
      } else {
        const res = await api.addFavorite(item.id);
        onFavQuota?.(res.favorites_count, res.favorites_max);
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, is_favorite: true } : x))
        );
        setSelected((cur) =>
          cur?.id === item.id ? { ...cur, is_favorite: true } : cur
        );
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("favorites_limit") || msg.includes("402")) {
        try {
          const j = JSON.parse(msg) as {
            detail?: { favorites_count?: number; favorites_max?: number | null };
          };
          const d = j?.detail;
          if (d) onFavQuota?.(d.favorites_count, d.favorites_max);
        } catch {
          /* ignore */
        }
        onUpgrade?.();
        return;
      }
      setError(e instanceof Error ? e.message : "Ошибка избранного");
    }
  }

  async function hideListing(item: ListingOut) {
    try {
      await api.hideListing(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setTotal((t) => Math.max(0, t - 1));
      setSelected((cur) => (cur?.id === item.id ? null : cur));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скрыть");
    }
  }

  if (loading) {
    return (
      <div className="center screen-pane">
        <div className="spinner" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="center panel screen-pane">
        <strong>Сначала настройте фильтр</strong>
        <p className="muted">Лента показывает объявления по активному поиску.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="center panel screen-pane">
        <strong>Пока пусто</strong>
        <p className="muted">Запустите поиск в фильтрах — здесь появятся все найденные объявления.</p>
        {error ? <div className="error">{error}</div> : null}
      </div>
    );
  }

  const hasMore = items.length < total;
  const browseImg = ads?.browse?.image_url || null;
  const browseClick = ads?.browse?.click_url || null;
  const showAd = !!(ads?.enabled && browseImg);

  return (
    <div className="screen-pane browse-screen">
      <div className="browse-head">
        <strong>Лента</strong>
      </div>
      {showAd ? (
        <button
          type="button"
          className="browse-ad-sticky"
          aria-label="Реклама"
          onClick={() => {
            if (browseClick) openExternalUrl(browseClick);
          }}
        >
          <span className="ad-badge">Реклама</span>
          <MediaImg src={browseImg!} alt="" />
        </button>
      ) : null}
      {error ? <div className="error" style={{ padding: "0 14px 8px" }}>{error}</div> : null}
      <div className="browse-list">
        {items.map((item) => (
          <BrowseRow
            key={item.id}
            item={item}
            onOpen={(it) => void openItem(it)}
            onToggleFav={toggleFav}
            onHide={hideListing}
          />
        ))}
      </div>
      {hasMore ? (
        <div className="browse-more">
          <button
            type="button"
            className="btn block"
            disabled={loadingMore}
            onClick={() => void load(false)}
          >
            {loadingMore ? "Загрузка…" : "Ещё"}
          </button>
        </div>
      ) : null}

      {selected ? (
        <ListingDetailSheet
          listing={selected}
          onClose={() => setSelected(null)}
          onToggleFav={() => toggleFav(selected)}
          onOutboundClick={onOutboundClick}
          onEngage={onEngage}
          isPro={isPro}
          onUpgrade={onUpgrade}
        />
      ) : null}
    </div>
  );
}
