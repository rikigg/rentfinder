import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import { MetroPicker } from "../components/MetroPicker";
import { ZoneMapPicker } from "../components/ZoneMapPicker";
import { metroStationsForCity } from "../data/metroStations";
import { IconAdd, IconBack, IconFilters, IconSearch, IconTick, IconTrash } from "../icons";
import { ProLockSheet } from "../components/ProLockSheet";
import type { FilterOut, MetroWalk, NotifyMode, SearchParams, SourceName } from "../types";
import { blurActiveInput, useKeyboardOpen } from "../useKeyboardOpen";

const CITIES = ["Москва", "Санкт-Петербург"];
const METRO_WALK_OPTS: { id: MetroWalk; label: string }[] = [
  { id: "upto_5", label: "до 5 мин" },
  { id: "upto_15", label: "до 15 мин" },
  { id: "upto_30", label: "до 30 мин" },
  { id: "from_30", label: "от 30 мин" },
];
const METRO_WALK_TO_MAX: Record<MetroWalk, number | null> = {
  upto_5: 5,
  upto_15: 15,
  upto_30: 30,
  from_30: null,
};
const TYPES = [
  { id: "apartment", label: "Квартира" },
  { id: "room", label: "Комната" },
  { id: "house", label: "Дом" },
  { id: "apartments", label: "Апартаменты" },
];
const ROOM_OPTS = [
  { id: 0, label: "Студия" },
  { id: 1, label: "1" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4+" },
];
const HOUSE_ROOM_OPTS = [
  { id: 1, label: "1" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4" },
  { id: 5, label: "5+" },
];
const RENOVATION_OPTS = [
  { id: "not_grandma", label: "Без бабушкиного" },
  { id: "grandma", label: "Бабушкин" },
  { id: "cosmetic", label: "Косметика" },
  { id: "euro", label: "Евро" },
  { id: "designer", label: "Дизайн" },
];

function normalizeRenovation(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string" && !!x);
  if (typeof raw === "string" && raw !== "any") return [raw];
  return [];
}
const BASE_SOURCE_OPTS: { id: SourceName; label: string; hint: string }[] = [
  { id: "yandex", label: "Яндекс", hint: "Метро пешком" },
  { id: "cian", label: "Циан", hint: "Собственник, лоджия, год дома" },
  { id: "avito", label: "Авито", hint: "Доп. текст в поиске" },
  { id: "domclick", label: "Домклик", hint: "Только апартаменты" },
];
const TG_SOURCE_OPT: { id: SourceName; label: string; hint: string } = {
  id: "telegram",
  label: "Telegram",
  hint: "Каналы с арендой",
};

type SourcesEnabled = Partial<Record<SourceName, boolean>>;

function isSourceOn(
  id: SourceName,
  telegramParse: boolean,
  sourcesEnabled?: SourcesEnabled
): boolean {
  if (sourcesEnabled && sourcesEnabled[id] === false) return false;
  if (id === "telegram" && !telegramParse) return false;
  return true;
}

/** Full catalog for showcase dummies (always includes Telegram chip). */
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

const MAX_FILTERS = 5;

const NOTIFY_OPTS: { id: NotifyMode; label: string; hint: string }[] = [
  { id: "off", label: "Выкл", hint: "Без сообщений в боте" },
  { id: "on_new", label: "При новых", hint: "Сразу после обновления, если нашлись новые" },
  { id: "1h", label: "1 час", hint: "Не чаще раза в час" },
  { id: "12h", label: "12 часов", hint: "Не чаще раза в 12 часов" },
  { id: "24h", label: "24 часа", hint: "Не чаще раза в сутки" },
];

const NOTIFY_SHORT: Record<NotifyMode, string> = {
  off: "Без оповещений",
  on_new: "🔔 При новых",
  "1h": "🔔 Раз в час",
  "12h": "🔔 Раз в 12 ч",
  "24h": "🔔 Раз в 24 ч",
};

type Mode = "list" | "edit";

type Props = {
  filters?: FilterOut[];
  busy?: boolean;
  error?: string | null;
  initialParams?: SearchParams | null;
  forceCreate?: boolean;
  telegramParse?: boolean;
  sourcesEnabled?: SourcesEnabled;
  /** When true, show all platforms; non-parseable are dummy chips */
  sourcesShowcase?: boolean;
  nlpQueryEnabled?: boolean;
  isPro?: boolean;
  onUpgrade?: () => void;
  onBack?: () => void;
  onSave: (
    params: SearchParams,
    opts?: {
      createNew?: boolean;
      filterId?: number;
      notifyMode?: NotifyMode;
      /** default true — start parse and go to waiting */
      startParse?: boolean;
    }
  ) => void | Promise<void>;
  onActivate?: (id: number) => void;
  onDelete?: (id: number) => void;
  onNotifyChanged?: () => void;
};

function defaultParams(
  telegramParse = false,
  sourcesEnabled?: SourcesEnabled
): SearchParams {
  const opts = sourceOpts(telegramParse, sourcesEnabled);
  return {
    city: "Москва",
    property_type: "apartment",
    rooms: [1, 2],
    price_min: null,
    price_max: 80000,
    area_min: null,
    area_max: null,
    metro: null,
    metro_walk: null,
    district: null,
    pets_allowed: null,
    floor_min: null,
    floor_max: null,
    renovation: null,
    raw_query: null,
    sources: opts.map((s) => s.id),
    platform: {
      yandex: { metro_on_foot: true },
      cian: null,
      avito: null,
      domclick: null,
    },
  };
}

function summarize(
  params: SearchParams | Record<string, unknown> | null | undefined,
  telegramParse = false
): string {
  if (!params) return "Параметры не заданы";
  const p = params as SearchParams;
  const opts = sourceOpts(telegramParse);
  const allIds = opts.map((s) => s.id);
  const parts: string[] = [];
  if (p.city) {
    parts.push(String(p.city).includes("Петербург") ? "СПб" : String(p.city));
  }
  if (p.rooms?.length) {
    parts.push(
      p.rooms
        .map((r) => (r === 0 ? "студия" : r >= 4 ? "4+" : `${r}к`))
        .join(", ")
    );
  }
  if (p.price_max != null) parts.push(`до ${Math.round(Number(p.price_max) / 1000)}к`);
  else if (p.price_min != null) parts.push(`от ${Math.round(Number(p.price_min) / 1000)}к`);
  if (p.metro?.length) {
    parts.push(p.metro.length === 1 ? p.metro[0] : `метро ×${p.metro.length}`);
  } else if (p.district) parts.push(String(p.district));
  if (p.metro_walk) {
    parts.push(
      METRO_WALK_OPTS.find((o) => o.id === p.metro_walk)?.label || "до метро"
    );
  }
  if (p.sources?.length && p.sources.length < allIds.length) {
    parts.push(p.sources.map((s) => opts.find((o) => o.id === s)?.label || s).join("+"));
  }
  if (p.geo_zone?.coordinates?.[0]?.length) parts.push("зона на карте");
  const reno = normalizeRenovation(p.renovation);
  if (reno.length) {
    parts.push(
      reno
        .map((id) => RENOVATION_OPTS.find((o) => o.id === id)?.label || id)
        .join(", ")
    );
  }
  return parts.join(" · ") || "Без деталей";
}

export function FiltersScreen({
  filters = [],
  busy,
  error,
  initialParams = null,
  forceCreate = false,
  telegramParse = false,
  sourcesEnabled,
  sourcesShowcase = false,
  nlpQueryEnabled = true,
  isPro = false,
  onUpgrade,
  onBack,
  onSave,
  onActivate,
  onDelete,
  onNotifyChanged,
}: Props) {
  // Parseable only — what goes into search params / scrape
  const SOURCE_OPTS = sourceOpts(telegramParse, sourcesEnabled);
  const ALL_SOURCES = SOURCE_OPTS.map((s) => s.id);
  const PARSEABLE = new Set(ALL_SOURCES);
  // Visible chips (showcase → all platforms as dummies for non-parseable)
  const DISPLAY_OPTS = displaySourceOpts(telegramParse, sourcesEnabled, sourcesShowcase);
  const [mode, setMode] = useState<Mode>("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const bootstrapped = useRef(false);
  const [city, setCity] = useState("Москва");
  const [propertyType, setPropertyType] = useState("apartment");
  const [rooms, setRooms] = useState<number[]>([1, 2]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("80000");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [metro, setMetro] = useState<string[]>([]);
  const [metroWalk, setMetroWalk] = useState<MetroWalk | null>(null);
  const [district, setDistrict] = useState("");
  const [pets, setPets] = useState<"any" | "yes" | "no">("any");
  const [floorMin, setFloorMin] = useState("");
  const [floorMax, setFloorMax] = useState("");
  const [renovation, setRenovation] = useState<string[]>([]);
  const [sources, setSources] = useState<SourceName[]>(() =>
    sourceOpts(telegramParse, sourcesEnabled).map((s) => s.id)
  );
  const [yxMetroOnFoot, setYxMetroOnFoot] = useState(true);
  const [cianOwner, setCianOwner] = useState(false);
  const [cianLoggia, setCianLoggia] = useState(false);
  const [cianMetroWalk, setCianMetroWalk] = useState("");
  const [cianYearMin, setCianYearMin] = useState("");
  const [cianYearMax, setCianYearMax] = useState("");
  const [avitoExtra, setAvitoExtra] = useState("");
  const [dcOnlyApartments, setDcOnlyApartments] = useState(false);
  const [openSection, setOpenSection] = useState<"common" | SourceName | null>(null);
  const [lockOpen, setLockOpen] = useState(false);

  function requirePro(): boolean {
    if (isPro) return true;
    setLockOpen(true);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
    return false;
  }
  const [nlpText, setNlpText] = useState("");
  const [nlpBusy, setNlpBusy] = useState(false);
  const [nlpHint, setNlpHint] = useState<string | null>(null);
  const [nlpError, setNlpError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [geoZone, setGeoZone] = useState<SearchParams["geo_zone"]>(null);
  const [notifyMode, setNotifyMode] = useState<NotifyMode>("on_new");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const keyboardOpen = useKeyboardOpen();
  const [fieldFocused, setFieldFocused] = useState(false);
  const [kbOffset, setKbOffset] = useState(0);
  const [saveAction, setSaveAction] = useState<"save" | "search" | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(covered);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  function onFieldFocus() {
    setFieldFocused(true);
  }
  function onFieldBlur() {
    // defer: focus may move to another field
    window.setTimeout(() => {
      const ae = document.activeElement;
      const still =
        ae instanceof HTMLElement &&
        (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT");
      setFieldFocused(still);
    }, 0);
  }
  function onFieldKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      blurActiveInput();
    }
  }
  function onFormPointerDown(e: PointerEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (t.closest("input, textarea, select, button, a, label")) return;
    blurActiveInput();
  }

  function loadParams(initial?: SearchParams | null, modeHint?: NotifyMode) {
    const src = initial || defaultParams(telegramParse, sourcesEnabled);
    setCity(src.city || "Москва");
    setPropertyType(src.property_type || "apartment");
    setRooms(src.rooms || [1, 2]);
    setPriceMin(String(src.price_min ?? ""));
    setPriceMax(String(src.price_max ?? "80000"));
    setAreaMin(String(src.area_min ?? ""));
    setAreaMax(String(src.area_max ?? ""));
    setMetro([...(src.metro || [])]);
    setMetroWalk(
      src.metro_walk && METRO_WALK_OPTS.some((o) => o.id === src.metro_walk)
        ? src.metro_walk
        : null
    );
    setDistrict(src.district || "");
    setPets(
      src.pets_allowed === true ? "yes" : src.pets_allowed === false ? "no" : "any"
    );
    setFloorMin(String(src.floor_min ?? ""));
    setFloorMax(String(src.floor_max ?? ""));
    setRenovation(normalizeRenovation(src.renovation));
    const enabledOpts = sourceOpts(telegramParse, sourcesEnabled).map((s) => s.id);
    const allowed = new Set(enabledOpts);
    const incoming = (src.sources?.length ? [...src.sources] : [...enabledOpts]).filter(
      (s): s is SourceName => allowed.has(s as SourceName)
    );
    setSources(incoming.length ? incoming : [...enabledOpts]);
    const yx = src.platform?.yandex;
    setYxMetroOnFoot(yx?.metro_on_foot !== false);
    const cn = src.platform?.cian;
    setCianOwner(!!cn?.is_by_homeowner);
    setCianLoggia(!!cn?.have_loggia);
    setCianMetroWalk(String(cn?.metro_foot_minute ?? ""));
    setCianYearMin(String(cn?.min_house_year ?? ""));
    setCianYearMax(String(cn?.max_house_year ?? ""));
    setAvitoExtra(src.platform?.avito?.query_extra || "");
    setDcOnlyApartments(!!src.platform?.domclick?.only_apartments);
    setGeoZone(src.geo_zone || null);
    setOpenSection("common");
    setNlpText(src.raw_query || "");
    setNotifyMode(modeHint || "on_new");
  }

  useEffect(() => {
    // If list becomes empty while editing a deleted filter — back to list
    if (mode === "edit" && editingId != null && !filters.some((f) => f.id === editingId)) {
      setMode("list");
      setEditingId(null);
    }
  }, [filters, mode, editingId]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (initialParams) {
      setEditingId(null);
      loadParams(
        { ...defaultParams(telegramParse, sourcesEnabled), ...initialParams },
        "on_new"
      );
      setMode("edit");
      return;
    }
    if (forceCreate || filters.length === 0) {
      setEditingId(null);
      loadParams(defaultParams(telegramParse, sourcesEnabled), "on_new");
      setMode("edit");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditingId(null);
    loadParams(defaultParams(telegramParse, sourcesEnabled), "on_new");
    setMode("edit");
  }

  function openEdit(f: FilterOut) {
    setEditingId(f.id);
    loadParams(f.params as SearchParams, f.notify_mode || (f.notify_enabled ? "on_new" : "off"));
    setMode("edit");
  }

  async function changeNotify(modeNext: NotifyMode) {
    if (!isPro) {
      requirePro();
      return;
    }
    setNotifyMode(modeNext);
    if (editingId == null) return;
    setNotifyBusy(true);
    try {
      await api.setNotifyMode(editingId, modeNext);
      onNotifyChanged?.();
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    } catch (e) {
      setNlpError(e instanceof Error ? e.message : "Не удалось сохранить оповещения");
    } finally {
      setNotifyBusy(false);
    }
  }

  function backToList() {
    setMode("list");
    setEditingId(null);
  }

  function applyParams(p: SearchParams) {
    setCity(p.city || city);
    if (p.property_type) setPropertyType(p.property_type);
    if (p.rooms) setRooms(p.rooms);
    if (p.price_min != null) setPriceMin(String(p.price_min));
    if (p.price_max != null) setPriceMax(String(p.price_max));
    if (p.area_min != null) setAreaMin(String(p.area_min));
    if (p.area_max != null) setAreaMax(String(p.area_max));
    if (p.metro) setMetro([...p.metro]);
    if (p.metro_walk && METRO_WALK_OPTS.some((o) => o.id === p.metro_walk)) {
      setMetroWalk(p.metro_walk);
    } else if (p.metro_walk === null) {
      setMetroWalk(null);
    }
    if (p.district) setDistrict(p.district);
    if (p.pets_allowed === true) setPets("yes");
    else if (p.pets_allowed === false) setPets("no");
    if (p.floor_min != null) setFloorMin(String(p.floor_min));
    if (p.floor_max != null) setFloorMax(String(p.floor_max));
    if (p.renovation != null) setRenovation(normalizeRenovation(p.renovation));
    if (p.sources?.length) {
      const allowed = new Set(sourceOpts(telegramParse, sourcesEnabled).map((s) => s.id));
      setSources(p.sources.filter((s): s is SourceName => allowed.has(s as SourceName)));
    }
    if (p.geo_zone) setGeoZone(p.geo_zone);
    if (p.platform?.yandex?.metro_on_foot != null) {
      setYxMetroOnFoot(!!p.platform.yandex.metro_on_foot);
    }
    if (p.platform?.cian) {
      if (p.platform.cian.is_by_homeowner != null) setCianOwner(!!p.platform.cian.is_by_homeowner);
      if (p.platform.cian.have_loggia != null) setCianLoggia(!!p.platform.cian.have_loggia);
    }
  }

  function toggleSource(id: SourceName) {
    setSources((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((s) => s !== id);
      }
      return [...prev, id];
    });
  }

  async function runNlp() {
    if (!nlpText.trim()) return;
    setNlpBusy(true);
    setNlpError(null);
    setNlpHint(null);
    try {
      const res = await api.nlpExtract(nlpText.trim(), city);
      applyParams(res.params);
      if (res.needs_clarification && res.clarification_question) {
        setNlpHint(res.clarification_question);
      }
    } catch (e) {
      setNlpError(e instanceof Error ? e.message : "Не удалось распознать запрос");
    } finally {
      setNlpBusy(false);
    }
  }

  async function toggleMic() {
    if (recording && mediaRef.current) {
      mediaRef.current.stop();
      setRecording(false);
      return;
    }
    setNlpError(null);
    setNlpHint(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setNlpBusy(true);
        try {
          const res = await api.nlpVoice(blob);
          setNlpText(res.transcript || "");
          applyParams(res.params);
          if (res.needs_clarification && res.clarification_question) {
            setNlpHint(res.clarification_question);
          }
        } catch (e) {
          setNlpError(e instanceof Error ? e.message : "Ошибка распознавания голоса");
        } finally {
          setNlpBusy(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setNlpError("Нет доступа к микрофону");
    }
  }

  function buildParams(): SearchParams {
    const params: SearchParams = {
      city,
      property_type: propertyType,
      rooms: rooms.length ? rooms : null,
      price_min: priceMin ? Number(priceMin) : null,
      price_max: priceMax ? Number(priceMax) : null,
      area_min: areaMin ? Number(areaMin) : null,
      area_max: areaMax ? Number(areaMax) : null,
      metro: metro.length ? metro : null,
      metro_walk: metroWalk,
      district: district || null,
      pets_allowed: pets === "any" ? null : pets === "yes",
      floor_min: floorMin ? Number(floorMin) : null,
      floor_max: floorMax ? Number(floorMax) : null,
      renovation: isPro && renovation.length ? renovation : null,
      raw_query: nlpText || null,
      sources: (() => {
        const cleaned = sources.filter((s) => ALL_SOURCES.includes(s));
        return cleaned.length === ALL_SOURCES.length ? null : cleaned;
      })(),
      platform: {
        yandex: {
          metro_on_foot: metroWalk ? true : yxMetroOnFoot,
        },
        cian: {
          is_by_homeowner: cianOwner || null,
          have_loggia: cianLoggia || null,
          metro_foot_minute:
            (metroWalk ? METRO_WALK_TO_MAX[metroWalk] : null) ??
            (cianMetroWalk ? Number(cianMetroWalk) : null),
          min_house_year: cianYearMin ? Number(cianYearMin) : null,
          max_house_year: cianYearMax ? Number(cianYearMax) : null,
        },
        avito: { query_extra: avitoExtra.trim() || null },
        domclick: { only_apartments: dcOnlyApartments || null },
      },
      geo_zone: isPro ? geoZone || null : null,
    };
    return params;
  }

  function onCityChange(next: string) {
    setCity(next);
    const allowed = new Set(metroStationsForCity(next));
    setMetro((prev) => prev.filter((m) => allowed.has(m)));
  }

  async function handleSave(startParse: boolean) {
    if (busy) return;
    const params = buildParams();
    const modeToSave: NotifyMode = isPro ? notifyMode : "off";
    setSaveAction(startParse ? "search" : "save");
    try {
      const opts =
        editingId != null
          ? { filterId: editingId, notifyMode: modeToSave, startParse }
          : { createNew: true as const, notifyMode: modeToSave, startParse };
      await onSave(params, opts);
      if (!startParse) backToList();
    } finally {
      setSaveAction(null);
    }
  }

  if (mode === "list") {
    if (filters.length === 0) {
      return (
        <div className="screen-pane filters-page view-fade">
          <div className="filters-shell">
            {onBack ? (
              <button className="btn filter-back" type="button" onClick={onBack}>
                <IconBack size={18} />
                Настройки
              </button>
            ) : null}
            <div className="filters-empty">
              <div className="filter-empty-icon" aria-hidden>
                <IconFilters size={28} />
              </div>
              <strong className="filters-empty-title">Фильтры не настроены</strong>
              <p className="muted filters-empty-text">
                Добавьте фильтр — город, комнаты, бюджет — и запустите поиск.
              </p>
              {error ? <div className="error">{error}</div> : null}
              <button className="btn primary block filters-empty-cta" type="button" onClick={openNew}>
                <IconAdd size={18} />
                Добавить фильтр
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="screen-pane filters-page view-fade" key="filter-list">
        <div className="filters-shell filters-shell--list">
          {onBack ? (
            <button className="btn filter-back" type="button" onClick={onBack}>
              <IconBack size={18} />
              Настройки
            </button>
          ) : null}
          <div className="filter-list-head">
            <div>
              <strong>Мои фильтры</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Нажмите на плитку, чтобы посмотреть или изменить
              </p>
            </div>
            {filters.length < MAX_FILTERS ? (
              <button className="btn primary" type="button" onClick={openNew}>
                <IconAdd size={16} />
                Добавить
              </button>
            ) : null}
          </div>

          <div className="filter-tiles">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-tile${f.is_active ? " filter-tile--active" : ""}`}
                onClick={() => openEdit(f)}
              >
                <div className="filter-tile-top">
                  <span className="filter-tile-name">{f.name || `Фильтр #${f.id}`}</span>
                  {f.is_active ? <span className="filter-tile-badge">Активный</span> : null}
                </div>
                <div className="filter-tile-summary">{summarize(f.params, telegramParse)}</div>
                <div className="filter-tile-notify">
                  {NOTIFY_SHORT[(f.notify_mode as NotifyMode) || (f.notify_enabled ? "on_new" : "off")]}
                </div>
                <div className="filter-tile-actions">
                  {!f.is_active && onActivate ? (
                    <span
                      className="filter-tile-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivate(f.id);
                      }}
                    >
                      Сделать активным
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                      Открыть · изменить
                    </span>
                  )}
                  {onDelete ? (
                    <span
                      className="filter-tile-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(f.id);
                      }}
                    >
                      <IconTrash size={14} />
                      Удалить
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          {error ? <div className="error filters-list-error">{error}</div> : null}
        </div>
      </div>
    );
  }

  const showDone = fieldFocused || keyboardOpen;

  return (
    <div
      className="panel screen-pane filter-edit view-fade"
      key="filter-edit"
      onPointerDown={onFormPointerDown}
    >
      <button className="btn filter-back" type="button" onClick={backToList}>
        <IconBack size={18} />
        К списку
      </button>

      <div>
        <strong>{editingId != null ? "Редактирование фильтра" : "Новый фильтр"}</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Общие параметры для всех площадок, ниже — уникальные по каждой.
        </p>
      </div>

      <div
        className={`field${isPro ? "" : " field--pro-locked"}`}
        onClick={
          !isPro
            ? (e) => {
                e.preventDefault();
                requirePro();
              }
            : undefined
        }
      >
        <label>
          Оповещения в боте
          {!isPro ? <span className="pro-lock-tag">Pro</span> : null}
        </label>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
          {isPro
            ? NOTIFY_OPTS.find((o) => o.id === notifyMode)?.hint
            : "Доступно только в Pro"}
        </p>
        <div className="chips" aria-disabled={!isPro}>
          {NOTIFY_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`chip ${notifyMode === o.id ? "on" : ""}${!isPro ? " chip--locked" : ""}`}
              disabled={notifyBusy || busy}
              aria-disabled={!isPro}
              onClick={(e) => {
                e.stopPropagation();
                if (!requirePro()) return;
                void changeNotify(o.id);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {nlpQueryEnabled ? (
        <div className="field">
          <label>Свободный запрос</label>
          <textarea
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            enterKeyHint="done"
            placeholder="двушка у Сокола до 80 тысяч с котом"
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn"
              type="button"
              disabled={nlpBusy}
              onClick={() => {
                blurActiveInput();
                void runNlp();
              }}
            >
              Распознать
            </button>
            <button
              className="btn"
              type="button"
              disabled={nlpBusy}
              onClick={() => {
                blurActiveInput();
                void toggleMic();
              }}
            >
              {recording ? "⏹ Стоп" : "🎤 Голос"}
            </button>
            {nlpHint ? <p className="muted" style={{ margin: "8px 0 0" }}>{nlpHint}</p> : null}
            {nlpError ? <div className="error" style={{ marginTop: 8 }}>{nlpError}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="filter-section-title">Параметры поиска</div>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
        Общие фильтры и уникальные по каждой площадке.
      </p>

      <div className="platform-drops">
        <button
          type="button"
          className={`platform-drop-head${openSection === "common" ? " open" : ""}`}
          onClick={() => setOpenSection((s) => (s === "common" ? null : "common"))}
        >
          <span>Общие фильтры</span>
          <span className="platform-drop-chevron">{openSection === "common" ? "▾" : "▸"}</span>
        </button>
        {openSection === "common" ? (
          <div className="platform-drop-body">
            <div className="field">
              <label>Площадки</label>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                {sourcesShowcase
                  ? "Серые чипы — витрина (скоро). В поиск идут только активные."
                  : "Какие источники искать. Выключенные на сервере не сработают."}
              </p>
              <div className="chips">
                {DISPLAY_OPTS.map((s) => {
                  const parseable = PARSEABLE.has(s.id);
                  if (!parseable) {
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="chip on chip--dummy"
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
                      className={`chip ${sources.includes(s.id) ? "on" : ""}`}
                      onClick={() => toggleSource(s.id)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label>Город</label>
              <select
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Тип</label>
              <div className="chips">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip ${propertyType === t.id ? "on" : ""}`}
                    onClick={() => {
                      setPropertyType(t.id);
                      if (t.id === "room") setRooms([]);
                      else if (t.id === "house") setRooms([2, 3]);
                      else if (propertyType === "room" || propertyType === "house")
                        setRooms([1, 2]);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {propertyType === "room" ? (
              <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
                Для комнаты фильтр по числу комнат не нужен.
              </p>
            ) : (
              <div className="field">
                <label>{propertyType === "house" ? "Комнаты / спальни" : "Комнаты"}</label>
                <div className="chips">
                  {(propertyType === "house" ? HOUSE_ROOM_OPTS : ROOM_OPTS).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`chip ${rooms.includes(r.id) ? "on" : ""}`}
                      onClick={() =>
                        setRooms((prev) =>
                          prev.includes(r.id)
                            ? prev.filter((x) => x !== r.id)
                            : [...prev, r.id].sort()
                        )
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`field${isPro ? "" : " field--pro-locked"}`}
              onClick={
                !isPro
                  ? (e) => {
                      e.preventDefault();
                      requirePro();
                    }
                  : undefined
              }
            >
              <label>
                Ремонт по фото
                {!isPro ? <span className="pro-lock-tag">Pro</span> : null}
              </label>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                {isPro
                  ? "Можно несколько. «Без бабушкиного» — косметика и выше."
                  : "На Trial только «Любой». Выбор типа ремонта — в Pro."}
              </p>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${renovation.length === 0 ? "on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenovation([]);
                  }}
                >
                  Любой
                </button>
                {RENOVATION_OPTS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`chip ${renovation.includes(r.id) ? "on" : ""}${!isPro ? " chip--locked" : ""}`}
                    aria-disabled={!isPro}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!requirePro()) return;
                      setRenovation((prev) =>
                        prev.includes(r.id)
                          ? prev.filter((x) => x !== r.id)
                          : [...prev, r.id]
                      );
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>Цена от</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
              <div className="field">
                <label>Цена до</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>м² от</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={areaMin}
                  onChange={(e) => setAreaMin(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
              <div className="field">
                <label>м² до</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={areaMax}
                  onChange={(e) => setAreaMax(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>Этаж от</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={floorMin}
                  onChange={(e) => setFloorMin(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
              <div className="field">
                <label>Этаж до</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={floorMax}
                  onChange={(e) => setFloorMax(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
            </div>

            <div className="field">
              <MetroPicker
                city={city}
                value={metro}
                onChange={setMetro}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
              />
            </div>

            <div className="field">
              <label>Время до метро пешком</label>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                Для всех площадок. Без выбора — без ограничения.
              </p>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${metroWalk == null ? "on" : ""}`}
                  onClick={() => setMetroWalk(null)}
                >
                  Любое
                </button>
                {METRO_WALK_OPTS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`chip ${metroWalk === o.id ? "on" : ""}`}
                    onClick={() =>
                      setMetroWalk((prev) => (prev === o.id ? null : o.id))
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`field${isPro ? "" : " field--pro-locked"}`}
              onClick={
                !isPro
                  ? (e) => {
                      e.preventDefault();
                      requirePro();
                    }
                  : undefined
              }
            >
              <label>
                Зона на карте
                {!isPro ? <span className="pro-lock-tag">Pro</span> : null}
              </label>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                {isPro
                  ? "Нарисуйте область — останутся только объявления с координатами внутри"
                  : "Рисование зоны доступно в Pro"}
              </p>
              {isPro ? (
                <ZoneMapPicker city={city} value={geoZone} onChange={setGeoZone} />
              ) : (
                <button
                  type="button"
                  className="btn block"
                  onClick={(e) => {
                    e.stopPropagation();
                    requirePro();
                  }}
                >
                  Открыть карту · Pro
                </button>
              )}
            </div>

            <div className="field">
              <label>Район</label>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                enterKeyHint="done"
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
                onKeyDown={onFieldKeyDown}
              />
            </div>

            <div className="field">
              <label>Животные</label>
              <div className="chips">
                {(
                  [
                    ["any", "Не важно"],
                    ["yes", "Можно"],
                    ["no", "Нельзя"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`chip ${pets === id ? "on" : ""}`}
                    onClick={() => setPets(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {ALL_SOURCES.includes("yandex") ? (
          <>
        <button
          type="button"
          className={`platform-drop-head${openSection === "yandex" ? " open" : ""}${sources.includes("yandex") ? "" : " off"}`}
          onClick={() => setOpenSection((s) => (s === "yandex" ? null : "yandex"))}
        >
          <span>Яндекс Недвижимость</span>
          <span className="platform-drop-chevron">{openSection === "yandex" ? "▾" : "▸"}</span>
        </button>
        {openSection === "yandex" ? (
          <div className="platform-drop-body">
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {SOURCE_OPTS.find((s) => s.id === "yandex")?.hint}
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={yxMetroOnFoot}
                onChange={(e) => setYxMetroOnFoot(e.target.checked)}
              />
              <span>Метро пешком</span>
            </label>
          </div>
        ) : null}
          </>
        ) : null}

        {ALL_SOURCES.includes("cian") ? (
          <>
        <button
          type="button"
          className={`platform-drop-head${openSection === "cian" ? " open" : ""}${sources.includes("cian") ? "" : " off"}`}
          onClick={() => setOpenSection((p) => (p === "cian" ? null : "cian"))}
        >
          <span>Циан</span>
          <span className="platform-drop-chevron">{openSection === "cian" ? "▾" : "▸"}</span>
        </button>
        {openSection === "cian" ? (
          <div className="platform-drop-body">
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {SOURCE_OPTS.find((s) => s.id === "cian")?.hint}
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={cianOwner}
                onChange={(e) => setCianOwner(e.target.checked)}
              />
              <span>Только от собственника</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={cianLoggia}
                onChange={(e) => setCianLoggia(e.target.checked)}
              />
              <span>Есть лоджия / балкон</span>
            </label>
            <div className="field">
              <label>Пешком до метро, мин</label>
              <input
                inputMode="numeric"
                enterKeyHint="done"
                value={cianMetroWalk}
                onChange={(e) => setCianMetroWalk(e.target.value)}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
                onKeyDown={onFieldKeyDown}
                placeholder="например 15"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Год дома от</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={cianYearMin}
                  onChange={(e) => setCianYearMin(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
              <div className="field">
                <label>Год дома до</label>
                <input
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={cianYearMax}
                  onChange={(e) => setCianYearMax(e.target.value)}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                  onKeyDown={onFieldKeyDown}
                />
              </div>
            </div>
          </div>
        ) : null}
          </>
        ) : null}

        {ALL_SOURCES.includes("avito") ? (
          <>
        <button
          type="button"
          className={`platform-drop-head${openSection === "avito" ? " open" : ""}${sources.includes("avito") ? "" : " off"}`}
          onClick={() => setOpenSection((p) => (p === "avito" ? null : "avito"))}
        >
          <span>Авито</span>
          <span className="platform-drop-chevron">{openSection === "avito" ? "▾" : "▸"}</span>
        </button>
        {openSection === "avito" ? (
          <div className="platform-drop-body">
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {SOURCE_OPTS.find((s) => s.id === "avito")?.hint}
            </p>
            <div className="field">
              <label>Доп. текст в поиске</label>
              <input
                value={avitoExtra}
                onChange={(e) => setAvitoExtra(e.target.value)}
                placeholder="без посредников, мебель…"
                enterKeyHint="done"
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
                onKeyDown={onFieldKeyDown}
              />
            </div>
          </div>
        ) : null}
          </>
        ) : null}

        {ALL_SOURCES.includes("domclick") ? (
          <>
        <button
          type="button"
          className={`platform-drop-head${openSection === "domclick" ? " open" : ""}${sources.includes("domclick") ? "" : " off"}`}
          onClick={() => setOpenSection((p) => (p === "domclick" ? null : "domclick"))}
        >
          <span>Домклик</span>
          <span className="platform-drop-chevron">{openSection === "domclick" ? "▾" : "▸"}</span>
        </button>
        {openSection === "domclick" ? (
          <div className="platform-drop-body">
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {SOURCE_OPTS.find((s) => s.id === "domclick")?.hint}. Ремонт — в общих фильтрах.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={dcOnlyApartments}
                onChange={(e) => setDcOnlyApartments(e.target.checked)}
              />
              <span>Только апартаменты</span>
            </label>
          </div>
        ) : null}
          </>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}

      <ProLockSheet
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        onUpgrade={() => {
          setLockOpen(false);
          onUpgrade?.();
        }}
      />

      <div className="filter-edit-actions">
        <button
          className="btn primary block"
          type="button"
          disabled={busy}
          onClick={() => void handleSave(true)}
        >
          <IconSearch size={18} />
          {busy && saveAction === "search" ? "Ищем…" : "Искать"}
        </button>
        <button
          className="btn block"
          type="button"
          disabled={busy}
          onClick={() => void handleSave(false)}
        >
          <IconTick size={18} />
          {busy && saveAction === "save" ? "Сохраняем…" : "Сохранить"}
        </button>
        <p className="muted filter-edit-actions-hint">
          {editingId != null
            ? "«Сохранить» обновит фильтр без нового поиска. «Искать» — сохранит и запустит парсинг."
            : "«Сохранить» создаст фильтр. «Искать» — создаст и сразу найдёт объявления."}
        </p>
      </div>

      {editingId != null && onDelete ? (
        <button
          className="btn block"
          type="button"
          disabled={busy}
          onClick={() => {
            onDelete(editingId);
            backToList();
          }}
          style={{ marginTop: 4, color: "var(--pass)" }}
        >
          <IconTrash size={16} />
          Удалить фильтр
        </button>
      ) : null}

      {showDone
        ? createPortal(
            <div
              className="kb-done-bar"
              role="toolbar"
              aria-label="Клавиатура"
              style={{ bottom: kbOffset }}
            >
              <button type="button" className="btn kb-done-btn" onClick={blurActiveInput}>
                Готово
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
