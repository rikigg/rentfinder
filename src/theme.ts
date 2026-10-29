const THEME_KEY = "rentfinder_theme";

export type ThemeMode = "mono-light" | "mono-dark";

export type ThemeScheme = "light" | "dark";

export type ThemeMeta = {
  id: ThemeMode;
  name: string;
  emoji: string;
  blurb: string;
  scheme: ThemeScheme;
  swatches: string[];
  /** Telegram header / background */
  tgBg: string;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "mono-light",
    name: "Светлая тема",
    emoji: "☀️",
    blurb: "Soft UI · оранжевый акцент",
    scheme: "light",
    swatches: ["#F0F1F5", "#E7E9EF", "#FF851F", "#5A6478"],
    tgBg: "#F0F1F5",
  },
  {
    id: "mono-dark",
    name: "Тёмная тема",
    emoji: "🌙",
    blurb: "Depth · photo-first",
    scheme: "dark",
    swatches: ["#000000", "#171717", "#262626", "#FAFAFA"],
    tgBg: "#000000",
  },
];

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

/** Map removed classic themes → studio pair */
const LEGACY: Record<string, ThemeMode> = {
  light: "mono-light",
  ocean: "mono-light",
  cloud: "mono-light",
  dark: "mono-dark",
};

export function getThemeMeta(id: ThemeMode): ThemeMeta {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function resolveTheme(preferred?: string | null): ThemeMode {
  if (!preferred) return "mono-light";
  if (THEME_IDS.has(preferred)) return preferred as ThemeMode;
  if (preferred in LEGACY) return LEGACY[preferred];
  return "mono-light";
}

export function loadStoredTheme(): ThemeMode {
  return resolveTheme(localStorage.getItem(THEME_KEY));
}

export function applyTheme(mode: ThemeMode) {
  const meta = getThemeMeta(mode);
  const root = document.documentElement;
  root.classList.add("theme-animating");
  root.setAttribute("data-theme", mode);
  root.setAttribute("data-scheme", meta.scheme);
  window.setTimeout(() => root.classList.remove("theme-animating"), 280);
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.setHeaderColor?.(meta.tgBg);
    tg.setBackgroundColor?.(meta.tgBg);
  } catch {
    /* older clients */
  }
}

export function setThemeMode(mode: ThemeMode): ThemeMode {
  const next = resolveTheme(mode);
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  return next;
}

/** @deprecated use setThemeMode — kept for safety if anything still imports it */
export function cycleTheme(current: ThemeMode): ThemeMode {
  const i = THEMES.findIndex((t) => t.id === current);
  const next = THEMES[(i + 1) % THEMES.length]?.id || "mono-light";
  return setThemeMode(next);
}

export function initTheme(): ThemeMode {
  const mode = loadStoredTheme();
  applyTheme(mode);
  return mode;
}
