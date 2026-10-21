import { useState, type ReactNode } from "react";
import { IconBack } from "../icons";

type PayMethod = "stars" | "tribute";

const PRO_FEATURES = [
  "Безлимитные свайпы",
  "Оповещения о новых квартирах в боте",
  "Полное избранное без лимита",
  "Все фильтры: ремонт, зона на карте",
  "Плашка собственник / риэлтор",
  "Калькулятор въезда (залог + комиссия)",
];

const TRIAL_FEATURES = [
  "Дневной лимит свайпов",
  "Лимит избранного",
  "Базовые фильтры",
  "Бонус за канал: +свайпы/сутки",
];

/** Premium roadmap copy (marketing only — not gated yet). */
const PREMIUM_FEATURES = [
  "Всё из Pro",
  "Мгновенные уведомления о новых объявлениях или снижении цены",
  "Приоритетный парсинг — новые лоты раньше Trial/Pro",
  "AI-фильтрация",
  "История цен",
  "Несколько активных фильтров сразу (районы / бюджеты)",
  "Фильтр времени до работы или учёбы по точке на карте",
  "Без рекламы",
];

type Props = {
  priceRub: number;
  stars: number;
  swipesLeft?: number;
  swipesTotal?: number;
  favoritesCount?: number;
  favoritesMax?: number | null;
  busy?: boolean;
  busyMethod?: PayMethod | null;
  error?: string | null;
  mode?: "trial" | "renew";
  onPayStars: () => void;
  onPayTribute: () => void;
  onBack?: () => void;
};

function formatRub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function TierFold({
  id,
  open,
  onToggle,
  label,
  hint,
  tone = "default",
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
  tone?: "default" | "accent" | "pay";
  children: ReactNode;
}) {
  return (
    <div className={`tier-fold tier-fold--${tone}${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="tier-fold-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="tier-fold-copy">
          <span className="tier-fold-label">{label}</span>
          {hint ? <span className="tier-fold-hint muted">{hint}</span> : null}
        </span>
        <span className="tier-fold-chevron" aria-hidden />
      </button>
      <div id={id} className="tier-fold-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

export function PaywallScreen({
  priceRub,
  stars,
  swipesLeft = 0,
  swipesTotal = 30,
  favoritesCount = 0,
  favoritesMax = 5,
  busy,
  busyMethod,
  error,
  mode = "trial",
  onPayStars,
  onPayTribute,
  onBack,
}: Props) {
  const swipeEnded = mode === "trial" && swipesLeft <= 0;
  const [trialOpen, setTrialOpen] = useState(false);
  const [proFeaturesOpen, setProFeaturesOpen] = useState(false);
  const [proPayOpen, setProPayOpen] = useState(true);
  const [premiumOpen, setPremiumOpen] = useState(false);

  return (
    <div className="screen-pane paywall paywall-tiers">
      {onBack ? (
        <button type="button" className="btn filter-back" disabled={busy} onClick={onBack}>
          <IconBack size={18} />
          Назад
        </button>
      ) : null}
      <header className="paywall-tiers-head">
        <h1 className="paywall-title">Выберите план</h1>
        <p className="muted paywall-text">
          {mode === "renew"
            ? "Продлите Pro на 1 месяц — все лимиты снимаются."
            : swipeEnded
              ? "Дневной лимит на Trial исчерпан. Pro — без ограничений."
              : "Trial уже работает. Pro открывает полный поиск без дневных лимитов."}
        </p>
      </header>

      <div className="tier-cards">
        <article className={`tier-card tier-card--trial${mode === "trial" ? " is-current" : ""}`}>
          <div className="tier-card-top">
            <div className="tier-card-badge">Trial</div>
            <h2>Бесплатно</h2>
          </div>
          {mode === "trial" ? (
            <div className="tier-meter-row">
              <div className="tier-meter-pill">
                <span className="muted">Свайпы</span>
                <strong>
                  {Math.max(0, swipesLeft)}
                  <span className="muted">/{swipesTotal}</span>
                </strong>
              </div>
              {favoritesMax != null ? (
                <div className="tier-meter-pill">
                  <span className="muted">Избранное</span>
                  <strong>
                    {favoritesCount}
                    <span className="muted">/{favoritesMax}</span>
                  </strong>
                </div>
              ) : null}
            </div>
          ) : null}
          <TierFold
            id="tier-trial-features"
            open={trialOpen}
            onToggle={() => setTrialOpen((v) => !v)}
            label="Что входит"
            hint={`${TRIAL_FEATURES.length} пункта`}
          >
            <ul className="tier-list">
              {TRIAL_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </TierFold>
        </article>

        <article className="tier-card tier-card--pro is-featured">
          <div className="tier-card-top">
            <div className="tier-card-badge tier-card-badge--pro">Pro</div>
            <h2>Рекомендуем</h2>
          </div>
          <div className="paywall-price">
            <strong>{formatRub(priceRub)}</strong>
            <span>/ месяц</span>
          </div>
          <TierFold
            id="tier-pro-features"
            open={proFeaturesOpen}
            onToggle={() => setProFeaturesOpen((v) => !v)}
            label="Что даёт Pro"
            hint="безлимит и алерты"
            tone="accent"
          >
            <ul className="tier-list">
              {PRO_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </TierFold>
          <TierFold
            id="tier-pro-pay"
            open={proPayOpen}
            onToggle={() => setProPayOpen((v) => !v)}
            label="Оплатить"
            hint={`${formatRub(priceRub)} · Stars или СБП`}
            tone="pay"
          >
            <div className="pay-methods">
              <button
                type="button"
                className={`pay-method pay-method--tribute pay-method--featured${
                  busyMethod === "tribute" ? " is-busy" : ""
                }`}
                disabled={busy}
                onClick={onPayTribute}
              >
                <span className="pay-method-badge pay-method-badge--tribute" aria-hidden>
                  T
                </span>
                <span className="pay-method-copy">
                  <span className="pay-method-title-row">
                    <strong>Tribute</strong>
                    <span className="pay-method-tag">СБП</span>
                  </span>
                  <span className="muted">
                    {busyMethod === "tribute"
                      ? "Открываем…"
                      : `${formatRub(priceRub)} · карта · СБП`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`pay-method pay-method--stars${
                  busyMethod === "stars" ? " is-busy" : ""
                }`}
                disabled={busy}
                onClick={onPayStars}
              >
                <span className="pay-method-badge pay-method-badge--stars" aria-hidden>
                  ★
                </span>
                <span className="pay-method-copy">
                  <strong>Telegram Stars</strong>
                  <span className="muted">
                    {busyMethod === "stars" ? "Открываем оплату…" : `${stars} ★ · 1 месяц`}
                  </span>
                </span>
              </button>
            </div>
          </TierFold>
        </article>

        <article className="tier-card tier-card--premium">
          <div className="tier-card-top">
            <div className="tier-card-badge tier-card-badge--premium">Premium</div>
            <h2>Скоро</h2>
          </div>
          <TierFold
            id="tier-premium-features"
            open={premiumOpen}
            onToggle={() => setPremiumOpen((v) => !v)}
            label="Что даёт Premium"
            hint="выше Pro · скоро"
            tone="accent"
          >
            <ul className="tier-list">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </TierFold>
        </article>
      </div>

      <p className="muted paywall-note">
        Tribute — карта или СБП. Stars активируют Pro сразу после оплаты.
      </p>
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
