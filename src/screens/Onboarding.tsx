import { useEffect, useMemo, useRef, useState } from "react";
import { HouseSearchAnim } from "../components/HouseSearchAnim";
import { IconDiscover, IconFavorites, IconSettings, IconTick } from "../icons";
import { openExternalUrl } from "../lib/openUrl";
import type { ChannelBonusResult, SearchParams, SourceName } from "../types";

type SourcesEnabled = Partial<Record<SourceName, boolean>>;

type Props = {
  step: number;
  city?: string;
  telegramParse?: boolean;
  sourcesEnabled?: SourcesEnabled;
  /** Show all platform chips; non-parseable are dummies */
  sourcesShowcase?: boolean;
  /** First-run only: persist filters when leaving the filters slide / finishing. */
  persistFilters?: boolean;
  channelUrl?: string;
  channelBonusAmount?: number;
  channelBonusClaimed?: boolean;
  onClaimChannelBonus?: () => Promise<ChannelBonusResult>;
  onNext: () => void;
  onFinish: (params?: SearchParams | null) => void;
  /** Fired once filters are valid and user leaves the filters step (first-run). */
  onFiltersCommit?: (params: SearchParams) => void;
  onBack?: () => void;
};

const BASE_SOURCE_OPTS: { id: SourceName; label: string }[] = [
  { id: "yandex", label: "Яндекс" },
  { id: "cian", label: "Циан" },
  { id: "avito", label: "Авито" },
  { id: "domclick", label: "Домклик" },
];
const TG_SOURCE_OPT: { id: SourceName; label: string } = {
  id: "telegram",
  label: "Telegram",
};

function isSourceOn(
  id: SourceName,
  telegramParse: boolean,
  sourcesEnabled?: SourcesEnabled
): boolean {
  if (sourcesEnabled && sourcesEnabled[id] === false) return false;
  if (id === "telegram" && !telegramParse) return false;
  return true;
}

const SHOWCASE_SOURCE_OPTS = [...BASE_SOURCE_OPTS, TG_SOURCE_OPT];

function sourceOpts(telegramParse: boolean, sourcesEnabled?: SourcesEnabled) {
  const base = telegramParse ? [...BASE_SOURCE_OPTS, TG_SOURCE_OPT] : BASE_SOURCE_OPTS;
  return base.filter((s) => isSourceOn(s.id, telegramParse, sourcesEnabled));
}

function displaySourceOpts(
  telegramParse: boolean,
  sourcesEnabled?: SourcesEnabled,
  sourcesShowcase?: boolean
) {
  if (sourcesShowcase) return SHOWCASE_SOURCE_OPTS;
  return sourceOpts(telegramParse, sourcesEnabled);
}

function allSources(telegramParse: boolean, sourcesEnabled?: SourcesEnabled): SourceName[] {
  return sourceOpts(telegramParse, sourcesEnabled).map((s) => s.id);
}

const CITIES = ["Москва", "Санкт-Петербург"] as const;
const TYPES = [
  { id: "apartment", label: "Квартира" },
  { id: "room", label: "Комната" },
  { id: "house", label: "Дом" },
  { id: "apartments", label: "Апарт." },
] as const;
const ROOM_OPTS_FLAT = [
  { id: 0, label: "Студия" },
  { id: 1, label: "1" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4+" },
] as const;
const ROOM_OPTS_HOUSE = [
  { id: 1, label: "1" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4" },
  { id: 5, label: "5+" },
] as const;

function roomOptsForType(type: string) {
  if (type === "room") return [] as { id: number; label: string }[];
  if (type === "house") return [...ROOM_OPTS_HOUSE];
  return [...ROOM_OPTS_FLAT];
}

function priceOptsForType(type: string): number[] {
  if (type === "room") return [25000, 35000, 45000, 60000, 80000];
  if (type === "house") return [100000, 150000, 200000, 300000, 500000];
  return [50000, 70000, 100000, 150000, 200000];
}

function defaultRoomsForType(type: string): number[] {
  if (type === "room") return [];
  if (type === "house") return [2, 3];
  return [1, 2];
}

function defaultPriceForType(type: string): number {
  if (type === "room") return 40000;
  if (type === "house") return 200000;
  return 80000;
}

function roomsLabelForType(type: string): string {
  if (type === "house") return "Комнаты / спальни";
  return "Комнаты";
}

export const ONBOARD_SLIDES = [
  {
    key: "welcome",
    title: "Поиск жилья",
    text: "Ищем квартиры на Яндексе, Циане, Авито и Домклике — и показываем в удобной ленте.",
    textWithTg:
      "Ищем квартиры на Яндексе, Циане, Авито, Домклике и в Telegram-каналах — и показываем в удобной ленте.",
  },
  {
    key: "filters",
    title: "Базовые фильтры",
    text: "Город, тип жилья и площадки. Без базовых параметров поиск не запустится.",
  },
  {
    key: "nlp",
    title: "Фильтр через ИИ",
    text: "Позже можно описать квартиру текстом или голосом — ИИ подставит параметры в фильтрах. Сейчас это просто знакомство.",
  },
  {
    key: "swipe",
    title: "Свайпы",
    text: "Вправо — в избранное, влево — пропустить. Кнопки внизу карточки делают то же самое.",
  },
  {
    key: "browse",
    title: "Обычная лента",
    text: "Список всех найденных объявлений. Дубли с разных площадок склеиваются в одну карточку.",
  },
  {
    key: "favorites",
    title: "Избранное",
    text: "Сохранённые квартиры и алерты о снижении цены прямо в чат.",
  },
  {
    key: "nav",
    title: "Навигация",
    text: "Снизу: поиск (свайпы или лента), избранное и настройки.",
  },
  {
    key: "plans",
    title: "Пока другие спят — вы уже смотрите",
    text: "Trial режет свайпы и избранное. Pro — безлимит, алерты о новых квартирах в боте раньше конкурентов, зона на карте, ремонт и калькулятор въезда. Одна удачная квартира окупает подписку.",
  },
  {
    key: "channel",
    title: "Бонус за канал",
    text: "Подпишитесь на наш Telegram-канал — и получите дополнительные свайпы каждый день на Trial.",
  },
] as const;

type BasicFilterState = {
  city: string;
  propertyType: string;
  rooms: number[];
  priceMax: number | null;
  sources: SourceName[];
};

function defaultBasic(
  city: string,
  telegramParse = false,
  sourcesEnabled?: SourcesEnabled
): BasicFilterState {
  return {
    city: city || "Москва",
    propertyType: "apartment",
    rooms: [1, 2],
    priceMax: 80000,
    sources: allSources(telegramParse, sourcesEnabled),
  };
}

function basicToParams(
  b: BasicFilterState,
  telegramParse = false,
  sourcesEnabled?: SourcesEnabled
): SearchParams {
  const rooms =
    b.propertyType === "room" || !b.rooms.length
      ? null
      : [...b.rooms].sort((a, c) => a - c);
  const allowed = new Set(allSources(telegramParse, sourcesEnabled));
  const picked = b.sources.filter((s) => allowed.has(s));
  const sources = picked.length ? picked : allSources(telegramParse, sourcesEnabled);
  return {
    city: b.city,
    property_type: b.propertyType,
    rooms,
    price_min: null,
    price_max: b.priceMax,
    area_min: null,
    area_max: null,
    metro: null,
    district: null,
    pets_allowed: null,
    floor_min: null,
    floor_max: null,
    renovation: null,
    raw_query: null,
    sources,
    platform: {
      yandex: sources.includes("yandex") ? { metro_on_foot: true } : null,
      cian: null,
      avito: null,
      domclick: null,
    },
  };
}

function isBasicValid(b: BasicFilterState): boolean {
  if (!b.city || !b.propertyType || b.priceMax == null || b.priceMax <= 0) return false;
  if (!b.sources.length) return false;
  if (b.propertyType === "room") return true;
  return b.rooms.length > 0;
}

function BasicFiltersForm({
  value,
  onChange,
  telegramParse = false,
  sourcesEnabled,
  sourcesShowcase = false,
}: {
  value: BasicFilterState;
  onChange: (next: BasicFilterState) => void;
  telegramParse?: boolean;
  sourcesEnabled?: SourcesEnabled;
  sourcesShowcase?: boolean;
}) {
  const roomOpts = roomOptsForType(value.propertyType);
  const priceOpts = priceOptsForType(value.propertyType);
  const showRooms = roomOpts.length > 0;
  const parseable = new Set(sourceOpts(telegramParse, sourcesEnabled).map((s) => s.id));
  const platforms = displaySourceOpts(telegramParse, sourcesEnabled, sourcesShowcase);

  function setType(type: string) {
    if (type === value.propertyType) return;
    onChange({
      ...value,
      propertyType: type,
      rooms: defaultRoomsForType(type),
      priceMax: defaultPriceForType(type),
    });
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  function toggleRoom(id: number) {
    const has = value.rooms.includes(id);
    const rooms = has ? value.rooms.filter((r) => r !== id) : [...value.rooms, id];
    onChange({ ...value, rooms });
  }

  function toggleSource(id: SourceName) {
    const has = value.sources.includes(id);
    if (has && value.sources.length <= 1) return;
    const sources = has ? value.sources.filter((s) => s !== id) : [...value.sources, id];
    onChange({ ...value, sources });
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  return (
    <div className="ob-demo ob-demo-filters ob-filters-live">
      <div className="ob-field">
        <span className="ob-field-label">Город</span>
        <div className="ob-chip-row">
          {CITIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`ob-chip${value.city === c ? " on" : ""}`}
              onClick={() => onChange({ ...value, city: c })}
            >
              {c === "Санкт-Петербург" ? "СПб" : c}
            </button>
          ))}
        </div>
      </div>

      <div className="ob-field">
        <span className="ob-field-label">Тип жилья</span>
        <div className="ob-chip-row">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ob-chip${value.propertyType === t.id ? " on" : ""}`}
              onClick={() => setType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {showRooms ? (
        <div className="ob-field" key={`rooms-${value.propertyType}`}>
          <span className="ob-field-label">{roomsLabelForType(value.propertyType)}</span>
          <div className="ob-chip-row">
            {roomOpts.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`ob-chip${value.rooms.includes(r.id) ? " on" : ""}`}
                onClick={() => toggleRoom(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="ob-type-hint muted">Для комнаты число комнат не нужно — ищем объявления о сдаче комнаты.</p>
      )}

      <div className="ob-field" key={`price-${value.propertyType}`}>
        <span className="ob-field-label">Бюджет до</span>
        <div className="ob-chip-row">
          {priceOpts.map((p) => (
            <button
              key={p}
              type="button"
              className={`ob-chip${value.priceMax === p ? " on" : ""}`}
              onClick={() => onChange({ ...value, priceMax: p })}
            >
              {p >= 1000 ? `${Math.round(p / 1000)}к` : String(p)}
            </button>
          ))}
        </div>
        <label className="ob-price-custom">
          <span className="muted">или своя сумма</span>
          <input
            type="number"
            inputMode="numeric"
            min={5000}
            step={5000}
            placeholder={String(defaultPriceForType(value.propertyType))}
            value={value.priceMax ?? ""}
            onChange={(e) => {
              const n = e.target.value ? Number(e.target.value) : null;
              onChange({ ...value, priceMax: n != null && !Number.isNaN(n) ? n : null });
            }}
          />
        </label>
      </div>

      <div className="ob-field">
        <span className="ob-field-label">Площадки</span>
        <div className="ob-chip-row">
          {platforms.map((s) => {
            const canParse = parseable.has(s.id);
            if (!canParse) {
              return (
                <button
                  key={s.id}
                  type="button"
                  className="ob-chip on ob-chip--dummy"
                  disabled
                  title="Скоро"
                  aria-disabled
                >
                  {s.label}
                </button>
              );
            }
            return (
              <button
                key={s.id}
                type="button"
                className={`ob-chip${value.sources.includes(s.id) ? " on" : ""}`}
                onClick={() => toggleSource(s.id)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DemoNlpGuide() {
  return (
    <div className="ob-demo ob-demo-nlp-guide" aria-hidden>
      <div className="ob-nlp-bubble user">двушка у Сокола до 80 тысяч с котом</div>
      <div className="ob-nlp-bubble ai">
        <span className="ob-nlp-chip">СПб → Москва</span>
        <span className="ob-nlp-chip">2к</span>
        <span className="ob-nlp-chip">до 80к</span>
        <span className="ob-nlp-chip">метро Сокол</span>
      </div>
      <div className="ob-nlp-mic">🎤</div>
    </div>
  );
}

function DemoSwipe() {
  return (
    <div className="ob-demo ob-demo-swipe">
      <div className="ob-swipe-stack">
        <div className="ob-card back alt" aria-hidden>
          <div className="ob-card-photo">
            <span className="ob-card-dots" aria-hidden>
              <i className="on" />
              <i />
              <i />
            </span>
          </div>
          <div className="ob-card-meta">
            <strong>58 000 ₽</strong>
            <span>2к · 48 м² · Сокол</span>
          </div>
        </div>
        <div className="ob-card front">
          <div className="ob-card-photo">
            <span className="ob-card-dots" aria-hidden>
              <i className="on" />
              <i />
              <i />
              <i />
            </span>
          </div>
          <span className="ob-card-stamp pass">✕ Пропуск</span>
          <span className="ob-card-stamp like">♥ В избранное</span>
          <div className="ob-card-meta">
            <strong>65 000 ₽</strong>
            <span>1к · 38 м² · Менделеевская</span>
          </div>
          <div className="ob-fabs">
            <span className="ob-fab undo" aria-hidden>
              ↩
            </span>
            <span className="ob-fab pass" aria-hidden>
              ✕
            </span>
            <span className="ob-fab like" aria-hidden>
              ♥
            </span>
          </div>
        </div>
      </div>
      <div className="ob-swipe-hints" aria-hidden>
        <span className="ob-swipe-hint left">← пропуск</span>
        <span className="ob-swipe-hint right">избранное →</span>
      </div>
    </div>
  );
}

function DemoBrowse() {
  return (
    <div className="ob-demo ob-demo-browse">
      {[0, 1].map((i) => (
        <div key={i} className="ob-list-row">
          <div className="ob-list-thumb" />
          <div className="ob-list-meta">
            <b>{[72000, 55000][i].toLocaleString("ru-RU")} ₽</b>
            <span>Циан · Яндекс</span>
          </div>
          <span className="ob-list-star">☆</span>
        </div>
      ))}
    </div>
  );
}

function DemoFavorites() {
  return (
    <div className="ob-demo ob-demo-fav">
      <div className="ob-share">📉 −5 000 ₽ · алерт в Telegram</div>
      <div className="ob-list-row">
        <div className="ob-list-thumb" />
        <div className="ob-list-meta">
          <b>70 000 ₽</b>
          <span>уведомление о цене</span>
        </div>
      </div>
    </div>
  );
}

function DemoNav() {
  const items = [
    { icon: <IconDiscover size={18} />, label: "Поиск" },
    { icon: <IconFavorites size={18} />, label: "Избранное" },
    { icon: <IconSettings size={18} />, label: "Ещё" },
  ];
  return (
    <div className="ob-demo ob-demo-nav">
      <div className="ob-nav">
        {items.map((it) => (
          <div key={it.label} className="ob-nav-item">
            <span className="ob-nav-btn">{it.icon}</span>
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoChannel({ bonusAmount }: { bonusAmount: number }) {
  return (
    <div className="ob-demo ob-demo-channel" aria-hidden>
      <div className="ob-channel-badge">Telegram</div>
      <strong className="ob-channel-plus">+{bonusAmount}</strong>
      <span className="ob-channel-label">свайпов / сутки к Trial</span>
    </div>
  );
}

function DemoChannelCongrats({ bonusAmount }: { bonusAmount: number }) {
  return (
    <div className="ob-demo ob-demo-channel ob-demo-channel--ok" aria-hidden>
      <span className="ob-channel-check">
        <IconTick size={28} />
      </span>
      <strong className="ob-channel-plus">+{bonusAmount}</strong>
      <span className="ob-channel-label">свайпов каждый день</span>
    </div>
  );
}

function DemoPlans() {
  return (
    <div className="ob-demo ob-demo-plans" aria-hidden>
      <div className="ob-plan-card">
        <strong>Trial</strong>
        <span className="ob-plan-line ob-plan-line--bad">лимит свайпов / сутки</span>
        <span className="ob-plan-line ob-plan-line--bad">кап избранного</span>
        <span className="ob-plan-line ob-plan-line--bad">без алертов в боте</span>
      </div>
      <div className="ob-plan-card ob-plan-card--pro">
        <strong>Pro</strong>
        <span className="ob-plan-line ob-plan-line--ok">безлимит свайпов</span>
        <span className="ob-plan-line ob-plan-line--ok">алерты раньше других</span>
        <span className="ob-plan-line ob-plan-line--ok">зона · ремонт · калькулятор</span>
        <em className="ob-plan-cta">окупается одной квартирой</em>
      </div>
    </div>
  );
}

export function Onboarding({
  step,
  city = "Москва",
  telegramParse = false,
  sourcesEnabled,
  sourcesShowcase = false,
  persistFilters = false,
  channelUrl = "",
  channelBonusAmount = 5,
  channelBonusClaimed = false,
  onClaimChannelBonus,
  onNext,
  onFinish,
  onFiltersCommit,
  onBack,
}: Props) {
  const idx = Math.min(Math.max(step, 0), ONBOARD_SLIDES.length - 1);
  const slide = ONBOARD_SLIDES[idx];
  const last = idx >= ONBOARD_SLIDES.length - 1;
  const [basic, setBasic] = useState<BasicFilterState>(() =>
    defaultBasic(city, telegramParse, sourcesEnabled)
  );
  const [filterHint, setFilterHint] = useState<string | null>(null);
  const [channelPhase, setChannelPhase] = useState<"cta" | "congrats">(
    channelBonusClaimed ? "congrats" : "cta"
  );
  const [channelBusy, setChannelBusy] = useState(false);
  const [channelHint, setChannelHint] = useState<string | null>(null);
  const [grantedAmount, setGrantedAmount] = useState(channelBonusAmount);
  const checkInFlight = useRef(false);

  const filtersOk = isBasicValid(basic);
  const finalParams = useMemo(
    () => basicToParams(basic, telegramParse, sourcesEnabled),
    [basic, telegramParse, sourcesEnabled]
  );
  const slideText =
    slide.key === "welcome" && telegramParse && "textWithTg" in slide
      ? slide.textWithTg
      : slide.key === "channel"
        ? `Подпишитесь на канал и получите +${channelBonusAmount} свайпов каждый день на Trial. Бонус включается один раз.`
        : slide.text;

  useEffect(() => {
    if (slide.key !== "channel") return;
    if (channelBonusClaimed) setChannelPhase("congrats");
  }, [slide.key, channelBonusClaimed]);

  async function verifyChannelSub() {
    if (!onClaimChannelBonus || checkInFlight.current) return;
    checkInFlight.current = true;
    setChannelBusy(true);
    setChannelHint(null);
    try {
      const res = await onClaimChannelBonus();
      setGrantedAmount(res.bonus_amount || channelBonusAmount);
      if (res.bonus_granted || res.already_claimed) {
        setChannelPhase("congrats");
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        if (res.already_claimed && !res.bonus_granted) {
          setChannelHint("Бонус уже был начислен ранее");
        }
      } else if (res.check_error === "bot_not_admin" || res.check_error === "not_configured") {
        setChannelHint(
          "Проверка временно недоступна: бот должен быть админом канала. Попробуйте позже или пропустите шаг."
        );
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      } else if (!res.subscribed) {
        setChannelHint("Подписка не найдена. Откройте канал, подпишитесь и вернитесь сюда.");
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      } else {
        setChannelHint("Не удалось начислить бонус. Попробуйте ещё раз.");
      }
    } catch {
      setChannelHint("Ошибка проверки. Попробуйте ещё раз через пару секунд.");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setChannelBusy(false);
      checkInFlight.current = false;
    }
  }

  function openChannel() {
    const url = channelUrl.trim();
    if (!url) {
      setChannelHint("Канал ещё не настроен. Пропустите шаг или зайдите позже.");
      return;
    }
    setChannelHint("После подписки вернитесь и нажмите «Проверить подписку».");
    openExternalUrl(url);
  }

  function goNext() {
    if (slide.key === "filters" && !filtersOk) {
      setFilterHint(
        !basic.sources.length
          ? "Выберите хотя бы одну площадку"
          : basic.propertyType === "room"
            ? "Выберите город и бюджет"
            : "Выберите город, комнаты и бюджет"
      );
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      return;
    }
    setFilterHint(null);
    if (slide.key === "filters" && persistFilters && filtersOk) {
      onFiltersCommit?.(finalParams);
    }
    if (slide.key === "channel") {
      onFinish(finalParams);
      return;
    }
    if (last) onFinish(finalParams);
    else onNext();
  }

  const channelCongrats = slide.key === "channel" && channelPhase === "congrats";

  return (
    <div className="onboard">
      <div className="onboard-dots" aria-hidden>
        {ONBOARD_SLIDES.map((s, i) => (
          <i key={s.key} className={i === idx ? "on" : ""} />
        ))}
      </div>

      <div key={slide.key + (channelCongrats ? "-ok" : "")} className="onboard-slide view-fade">
        <div className={`onboard-visual${slide.key === "filters" ? " onboard-visual--filters" : ""}`}>
          {slide.key === "welcome" ? <HouseSearchAnim /> : null}
          {slide.key === "filters" ? (
            <BasicFiltersForm
              value={basic}
              telegramParse={telegramParse}
              sourcesEnabled={sourcesEnabled}
              sourcesShowcase={sourcesShowcase}
              onChange={(next) => {
                setBasic(next);
                if (filterHint) setFilterHint(null);
              }}
            />
          ) : null}
          {slide.key === "nlp" ? <DemoNlpGuide /> : null}
          {slide.key === "swipe" ? <DemoSwipe /> : null}
          {slide.key === "browse" ? <DemoBrowse /> : null}
          {slide.key === "favorites" ? <DemoFavorites /> : null}
          {slide.key === "nav" ? <DemoNav /> : null}
          {slide.key === "plans" ? <DemoPlans /> : null}
          {slide.key === "channel" && !channelCongrats ? (
            <DemoChannel bonusAmount={channelBonusAmount} />
          ) : null}
          {channelCongrats ? <DemoChannelCongrats bonusAmount={grantedAmount} /> : null}
        </div>

        <div className="onboard-copy">
          <h1>
            {channelCongrats ? "Бонус начислен!" : slide.title}
          </h1>
          <p>
            {channelCongrats
              ? `Вы подписаны. Каждый день +${grantedAmount} свайпов к Trial. Приятного поиска!`
              : slideText}
          </p>
          {filterHint && slide.key === "filters" ? (
            <p className="ob-filter-hint">{filterHint}</p>
          ) : null}
          {channelHint && slide.key === "channel" ? (
            <p className="ob-filter-hint">{channelHint}</p>
          ) : null}

          {slide.key === "channel" && !channelCongrats ? (
            <>
              <button
                className="btn primary block"
                type="button"
                disabled={channelBusy || !channelUrl}
                onClick={openChannel}
              >
                Подписаться на канал
              </button>
              <button
                className="btn block"
                type="button"
                disabled={channelBusy}
                onClick={() => void verifyChannelSub()}
              >
                {channelBusy ? "Проверяем…" : "Проверить подписку"}
              </button>
              <div className="onboard-secondary">
                <button className="btn block" type="button" onClick={goNext}>
                  Пропустить
                </button>
                {idx > 0 ? (
                  <button className="btn block" type="button" onClick={onBack}>
                    Назад
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {channelCongrats ? (
            <button className="btn primary block" type="button" onClick={goNext}>
              Закрыть
            </button>
          ) : null}

          {slide.key !== "channel" ? (
            <>
              <button
                className="btn primary block"
                type="button"
                disabled={slide.key === "filters" && !filtersOk}
                onClick={goNext}
              >
                Далее
              </button>
              <div className="onboard-secondary">
                {idx > 0 ? (
                  <button className="btn block" type="button" onClick={onBack}>
                    Назад
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
