import {
  IconDeck,
  IconExport,
  IconFeed,
  IconFilters,
  IconInfo,
  IconPalette,
  IconSub,
} from "../icons";
import { getThemeMeta, type ThemeMode } from "../theme";
import type { ViewMode } from "../types";

type Props = {
  hasSubscription: boolean;
  isAdmin?: boolean;
  subscriptionUntil?: string | null;
  swipesLeft?: number;
  swipesTotal?: number;
  filtersCount?: number;
  viewMode?: ViewMode | null;
  theme?: ThemeMode;
  channelUrl?: string;
  error?: string | null;
  onOpenSubscription: () => void;
  onOpenFilters: () => void;
  onOpenViewMode: () => void;
  onOpenTheme: () => void;
  onOpenGuide: () => void;
  onOpenChannel?: () => void;
};

function formatUntil(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function filtersLabel(n: number) {
  if (n === 1) return "1 фильтр";
  if (n >= 2 && n <= 4) return `${n} фильтра`;
  return `${n} фильтров`;
}

function viewModeHint(mode?: ViewMode | null) {
  if (mode === "deck") return "Свайпы";
  if (mode === "browse") return "Лента";
  return "Не выбран";
}

export function SettingsScreen({
  hasSubscription,
  isAdmin,
  subscriptionUntil,
  swipesLeft = 0,
  swipesTotal = 30,
  filtersCount = 0,
  viewMode = null,
  theme = "mono-light",
  channelUrl = "",
  error,
  onOpenSubscription,
  onOpenFilters,
  onOpenViewMode,
  onOpenTheme,
  onOpenGuide,
  onOpenChannel,
}: Props) {
  const until = formatUntil(subscriptionUntil);
  const subHint = isAdmin
    ? "Админ · без лимитов"
    : hasSubscription
      ? until
        ? `Pro · до ${until}`
        : "Pro · активна"
      : `Trial · свайпы ${Math.max(0, swipesLeft)}/${swipesTotal} сегодня`;
  const themeMeta = getThemeMeta(theme);

  return (
    <div className="screen-pane settings-screen">
      <div className="settings-shell">
        <header className="settings-head">
          <h1>Настройки</h1>
          <p className="muted">Подписка, фильтры, тема и просмотр</p>
        </header>

        {error ? <div className="error settings-error">{error}</div> : null}

        <section className="settings-group" aria-label="Основные">
          <button
            type="button"
            className="settings-tile settings-tile--sub"
            onClick={onOpenSubscription}
          >
            <span className="settings-tile-icon sub" aria-hidden>
              <IconSub size={24} />
            </span>
            <span className="settings-tile-body">
              <strong>Подписка</strong>
              <span className="muted">{subHint}</span>
            </span>
            <span className="settings-tile-pill" aria-hidden>
              {hasSubscription || isAdmin ? "PRO" : "trial"}
            </span>
            <span className="settings-tile-chevron" aria-hidden>
              ›
            </span>
          </button>

          <button type="button" className="settings-tile" onClick={onOpenFilters}>
            <span className="settings-tile-icon filters" aria-hidden>
              <IconFilters size={22} />
            </span>
            <span className="settings-tile-body">
              <strong>Фильтры</strong>
              <span className="muted">
                {filtersCount > 0 ? filtersLabel(filtersCount) : "Создайте первый фильтр"}
              </span>
            </span>
            <span className="settings-tile-chevron" aria-hidden>
              ›
            </span>
          </button>

          <button type="button" className="settings-tile" onClick={onOpenViewMode}>
            <span className="settings-tile-icon view" aria-hidden>
              {viewMode === "browse" ? <IconFeed size={22} /> : <IconDeck size={22} />}
            </span>
            <span className="settings-tile-body">
              <strong>Просмотр</strong>
              <span className="muted">{viewModeHint(viewMode)}</span>
            </span>
            <span className="settings-tile-chevron" aria-hidden>
              ›
            </span>
          </button>
        </section>

        <section className="settings-group" aria-label="Приложение">
          <button type="button" className="settings-tile" onClick={onOpenTheme}>
            <span className="settings-tile-icon theme" aria-hidden>
              <IconPalette size={22} />
            </span>
            <span className="settings-tile-body">
              <strong>Тема</strong>
              <span className="muted">
                {themeMeta.emoji} {themeMeta.name}
              </span>
            </span>
            <span className="settings-tile-chevron" aria-hidden>
              ›
            </span>
          </button>

          <button type="button" className="settings-tile" onClick={onOpenGuide}>
            <span className="settings-tile-icon guide" aria-hidden>
              <IconInfo size={22} />
            </span>
            <span className="settings-tile-body">
              <strong>Гайд</strong>
              <span className="muted">Повторный обзор приложения</span>
            </span>
            <span className="settings-tile-chevron" aria-hidden>
              ›
            </span>
          </button>

          {channelUrl ? (
            <button type="button" className="settings-tile" onClick={onOpenChannel}>
              <span className="settings-tile-icon channel" aria-hidden>
                <IconExport size={22} />
              </span>
              <span className="settings-tile-body">
                <strong>Telegram-канал</strong>
                <span className="muted">Новости и подборка</span>
              </span>
              <span className="settings-tile-chevron" aria-hidden>
                ›
              </span>
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
