import { IconBack } from "../icons";

const PRO_FEATURES = [
  "Безлимитные свайпы",
  "Оповещения о новых квартирах в боте",
  "Полное избранное",
  "Все фильтры (ремонт, зона на карте)",
  "Плашка собственник / риэлтор",
  "Калькулятор въезда",
];

type Props = {
  priceRub: number;
  stars: number;
  until?: string | null;
  isAdmin?: boolean;
  onBack: () => void;
  onRenew?: () => void;
};

function formatUntil(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionScreen({
  priceRub,
  stars,
  until,
  isAdmin,
  onBack,
  onRenew,
}: Props) {
  return (
    <div className="screen-pane filters-page">
      <div className="filters-shell filters-shell--list">
        <button type="button" className="btn filter-back" onClick={onBack}>
          <IconBack size={18} />
          Настройки
        </button>
        <div className="paywall-card sub-info-card">
          <div className="paywall-badge">{isAdmin ? "Админ" : "Pro"}</div>
          <h1 className="paywall-title">
            {isAdmin ? "Доступ без лимитов" : "Подписка Pro"}
          </h1>
          <p className="muted paywall-text">
            {isAdmin
              ? "Ваш аккаунт в списке администраторов: trial и оплата не требуются."
              : "Безлимитные свайпы, оповещения и полный доступ к фильтрам."}
          </p>
          {!isAdmin ? (
            <ul className="tier-list tier-list--compact">
              {PRO_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
          <div className="sub-info-rows">
            <div className="sub-info-row">
              <span className="muted">Статус</span>
              <strong>{isAdmin ? "Админ" : "Активна"}</strong>
            </div>
            {!isAdmin ? (
              <>
                <div className="sub-info-row">
                  <span className="muted">Действует до</span>
                  <strong>{formatUntil(until)}</strong>
                </div>
                <div className="sub-info-row">
                  <span className="muted">Тариф</span>
                  <strong>{priceRub.toLocaleString("ru-RU")} ₽ / мес</strong>
                </div>
                <div className="sub-info-row">
                  <span className="muted">Stars</span>
                  <strong>{stars} ★ / мес</strong>
                </div>
              </>
            ) : (
              <div className="sub-info-row">
                <span className="muted">Лимиты</span>
                <strong>Сняты</strong>
              </div>
            )}
          </div>
          {!isAdmin && onRenew ? (
            <button className="btn primary block" type="button" onClick={onRenew}>
              Продлить Pro
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
