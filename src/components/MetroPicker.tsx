import { useEffect, useMemo, useState } from "react";
import { metroStationsForCity } from "../data/metroStations";

type Props = {
  city: string;
  value: string[];
  onChange: (next: string[]) => void;
  onFieldFocus?: () => void;
  onFieldBlur?: () => void;
};

function cityShort(city: string) {
  return city.includes("Петербург") ? "СПб" : "Москва";
}

export function MetroPicker({ city, value, onChange, onFieldFocus, onFieldBlur }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const stations = useMemo(() => metroStationsForCity(city), [city]);
  const selected = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    setQuery("");
    setOpen(false);
  }, [city]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => s.toLowerCase().includes(q));
  }, [stations, query]);

  function toggle(name: string) {
    if (selected.has(name)) onChange(value.filter((x) => x !== name));
    else onChange([...value, name]);
  }

  function clearAll() {
    onChange([]);
  }

  const summary =
    value.length === 0
      ? `Любое · ${cityShort(city)}`
      : value.length === 1
        ? value[0]
        : value.length <= 3
          ? value.join(", ")
          : `${value.slice(0, 2).join(", ")} · +${value.length - 2}`;

  return (
    <div className="metro-picker">
      <button
        type="button"
        className={`metro-drop-head${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="metro-drop-main">
          <span className="metro-drop-title">Метро</span>
          <span className="metro-drop-summary">{summary}</span>
        </span>
        <span className="metro-drop-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="metro-drop-body">
          <p className="muted metro-hint">
            Станции {cityShort(city)}. Можно выбрать несколько.
          </p>

          {value.length ? (
            <div className="metro-selected">
              {value.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip on metro-chip"
                  onClick={() => toggle(name)}
                  title="Убрать"
                >
                  {name} ×
                </button>
              ))}
              <button type="button" className="metro-clear" onClick={clearAll}>
                Сбросить
              </button>
            </div>
          ) : null}

          <input
            className="metro-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            placeholder={`Поиск станции (${cityShort(city)})…`}
            enterKeyHint="search"
            autoComplete="off"
          />

          <div className="metro-list" role="listbox" aria-label="Станции метро" aria-multiselectable>
            {filtered.length === 0 ? (
              <div className="muted metro-empty">Ничего не найдено</div>
            ) : (
              filtered.map((name) => {
                const on = selected.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`metro-option${on ? " on" : ""}`}
                    onClick={() => toggle(name)}
                  >
                    <span className="metro-check" aria-hidden>
                      {on ? "✓" : ""}
                    </span>
                    <span>{name}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="muted metro-count">
            {value.length ? `Выбрано: ${value.length}` : `Станций: ${stations.length}`}
            {query.trim() ? ` · найдено ${filtered.length}` : ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}
