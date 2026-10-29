import { useEffect, useState } from "react";
import { IconClose, IconTick } from "../icons";
import { THEMES, type ThemeMode } from "../theme";

type Props = {
  current: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
  onClose: () => void;
};

const CLOSE_MS = 260;

export function ThemePicker({ current, onSelect, onClose }: Props) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setClosing(false);
  }, []);

  function finishClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }

  function pick(mode: ThemeMode) {
    onSelect(mode);
    finishClose();
  }

  return (
    <div
      className={`theme-picker${closing ? " theme-picker--out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор темы"
    >
      <button
        type="button"
        className="theme-picker-backdrop"
        aria-label="Закрыть"
        onClick={finishClose}
      />
      <div className="theme-picker-sheet">
        <div className="theme-picker-head">
          <div>
            <strong>Тема оформления</strong>
            <p className="theme-picker-sub">Выберите палитру интерфейса</p>
          </div>
          <button
            type="button"
            className="theme-picker-close"
            aria-label="Закрыть"
            onClick={finishClose}
          >
            <IconClose size={14} />
          </button>
        </div>
        <div className="theme-picker-list">
          {THEMES.map((t) => {
            const on = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-option${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() => pick(t.id)}
              >
                <span className="theme-option-emoji" aria-hidden>
                  {t.emoji}
                </span>
                <span className="theme-option-body">
                  <span className="theme-option-name">{t.name}</span>
                  <span className="theme-option-blurb">{t.blurb}</span>
                  <span className="theme-option-swatches" aria-hidden>
                    {t.swatches.map((c) => (
                      <span
                        key={c}
                        className="theme-swatch"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                </span>
                {on ? (
                  <span className="theme-option-check" aria-hidden>
                    <IconTick size={16} />
                  </span>
                ) : (
                  <span className="theme-option-check theme-option-check--empty" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
