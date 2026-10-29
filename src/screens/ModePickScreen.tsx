import { IconBack, IconDeck, IconFeed } from "../icons";
import type { ViewMode } from "../types";

type Props = {
  current?: ViewMode | null;
  changing?: boolean;
  onPick: (mode: ViewMode) => void;
  onBack?: () => void;
};

export function ModePickScreen({ current, changing, onPick, onBack }: Props) {
  function pick(kind: ViewMode) {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    onPick(kind);
  }

  return (
    <div className="screen-pane mode-pick">
      {onBack ? (
        <button type="button" className="btn filter-back" onClick={onBack}>
          <IconBack size={18} />
          Настройки
        </button>
      ) : null}
      <header className="mode-pick-head">
        <h1>{changing ? "Способ просмотра" : "Как смотреть?"}</h1>
        <p className="muted">
          {changing
            ? "Можно переключить в любой момент — выбор сохранится"
            : "Выберите удобный способ просмотра объявлений"}
        </p>
      </header>
      <div className="mode-pick-options">
        <button
          type="button"
          className={`mode-pick-card mode-pick-card--1${current === "deck" ? " mode-pick-card--on" : ""}`}
          onClick={() => pick("deck")}
        >
          <span className="mode-pick-icon" aria-hidden>
            <IconDeck size={28} />
          </span>
          <span className="mode-pick-title">Свайпы</span>
          <span className="mode-pick-desc">Карточки одна за другой — вправо в избранное, влево пропустить</span>
          {current === "deck" ? <span className="mode-pick-badge">Сейчас</span> : null}
        </button>
        <button
          type="button"
          className={`mode-pick-card mode-pick-card--2${current === "browse" ? " mode-pick-card--on" : ""}`}
          onClick={() => pick("browse")}
        >
          <span className="mode-pick-icon" aria-hidden>
            <IconFeed size={28} />
          </span>
          <span className="mode-pick-title">Лента</span>
          <span className="mode-pick-desc">Список всех найденных объявлений с деталями по тапу</span>
          {current === "browse" ? <span className="mode-pick-badge">Сейчас</span> : null}
        </button>
      </div>
    </div>
  );
}
