import { IconFilters, IconRefresh, IconWarning } from "../icons";

const STATUS_LABELS: Record<string, string> = {
  queued: "В очереди",
  pending: "Ожидание",
  running: "Ищем…",
  done: "Готово",
  failed: "Ошибка",
  cancelled: "Отменено",
};

type Props = {
  status?: string | null;
  resultsCount?: number;
  failedSources?: string[];
  error?: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
};

export function WaitingScreen({
  status,
  resultsCount,
  failedSources,
  error,
  onDismiss,
  onRetry,
}: Props) {
  const failed = status === "failed" || status === "cancelled";
  const label = status ? STATUS_LABELS[status] || status : null;

  return (
    <div className="center screen-pane">
      {!failed ? <div className="spinner" /> : (
        <div className="filter-empty-icon" aria-hidden>
          <IconWarning size={28} />
        </div>
      )}
      <strong>{failed ? "Поиск не удался" : "Ищем квартиры…"}</strong>
      <p className="muted">
        {failed
          ? "Не удалось получить объявления. Можно вернуться к фильтрам или попробовать снова."
          : "Сначала быстрые источники (Яндекс / TG), затем Циан и Авито. Обычно 20–40 сек."}
        {label ? (
          <>
            <br />
            Статус: {label}
            {typeof resultsCount === "number" && !failed
              ? ` · найдено ${resultsCount}`
              : ""}
          </>
        ) : null}
        {failedSources?.length ? (
          <>
            <br />
            Источники с ошибкой: {failedSources.join(", ")}
          </>
        ) : null}
        {error ? (
          <>
            <br />
            <span className="error">{error}</span>
          </>
        ) : null}
      </p>
      {failed ? (
        <div className="waiting-actions" style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {onRetry ? (
            <button className="btn primary" type="button" onClick={onRetry}>
              <IconRefresh size={16} />
              Повторить
            </button>
          ) : null}
          {onDismiss ? (
            <button className="btn" type="button" onClick={onDismiss}>
              <IconFilters size={16} />
              К фильтрам
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
