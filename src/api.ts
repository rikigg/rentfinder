import { absolutizeMediaInJson, apiBase } from "./lib/apiBase";
import type {
  ActiveFilterResponse,
  BrowseOpenResult,
  ChannelBonusResult,
  FilterOut,
  ListingOut,
  MeOut,
  NotifyMode,
  SearchParams,
  SearchTaskResult,
  SwipeResult,
  UserOut,
  ViewMode,
} from "./types";

function initData(): string {
  return window.Telegram?.WebApp?.initData || "";
}

function apiUrl(path: string): string {
  const base = apiBase();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    // Free ngrok interstitial: mobile Telegram WebView UA gets HTML instead of JSON
    // unless this header is set. Desktop often already has the bypass cookie.
    "ngrok-skip-browser-warning": "1",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const data = initData();
  if (data) headers["X-Telegram-Init-Data"] = data;
  if (init?.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (!text) {
    return {} as T;
  }
  try {
    return absolutizeMediaInJson(JSON.parse(text) as T);
  } catch (err) {
    if (err instanceof SyntaxError) {
      const looksLikeNgrok =
        /ngrok/i.test(text) || /ERR_NGROK/i.test(text) || /Visit Site/i.test(text);
      throw new Error(
        looksLikeNgrok
          ? "Туннель ngrok заблокировал запрос (телефон). Обновите Mini App через /start."
          : "Сервер вернул неверный ответ. Обновите Mini App через /start."
      );
    }
    throw err;
  }
}

export const api = {
  me: () => request<MeOut>("/me"),
  setViewMode: (mode: ViewMode) =>
    request<UserOut>("/me/view-mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
    }),
  setActiveFilter: (params: SearchParams, opts?: { startParse?: boolean; createNew?: boolean; name?: string }) =>
    request<ActiveFilterResponse>("/filters/active", {
      method: "PUT",
      body: JSON.stringify({
        params,
        start_parse: opts?.startParse ?? true,
        create_new: opts?.createNew ?? false,
        name: opts?.name,
      }),
    }),
  updateFilter: (
    id: number,
    params: SearchParams,
    opts?: { startParse?: boolean; name?: string }
  ) =>
    request<ActiveFilterResponse>(`/filters/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        params,
        start_parse: opts?.startParse ?? true,
        name: opts?.name,
      }),
    }),
  activateFilter: (id: number, startParse = true) =>
    request<ActiveFilterResponse>(`/filters/${id}/activate?start_parse=${startParse}`, {
      method: "PUT",
    }),
  deleteFilter: (id: number) =>
    request<{ ok: boolean }>(`/filters/${id}`, { method: "DELETE" }),
  setNotifyMode: (id: number, mode: NotifyMode) =>
    request<FilterOut>(`/filters/${id}/notify`, {
      method: "PUT",
      body: JSON.stringify({ mode }),
    }),
  feed: (limit = 20) => request<ListingOut[]>(`/feed?limit=${limit}`),
  browse: (limit = 30, offset = 0) =>
    request<{ items: ListingOut[]; total: number; offset: number; limit: number }>(
      `/browse?limit=${limit}&offset=${offset}`
    ),
  addFavorite: (listingId: number) =>
    request<{
      ok: boolean;
      is_favorite: boolean;
      favorites_count?: number;
      favorites_max?: number | null;
    }>(`/favorites/${listingId}`, {
      method: "POST",
    }),
  swipe: (listingId: number, direction: "left" | "right") =>
    request<SwipeResult>("/swipe", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId, direction }),
    }),
  listingOutbound: (listingId: number) =>
    request<BrowseOpenResult>("/listings/outbound", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId }),
    }),
  undo: () =>
    request<{
      ok: boolean;
      listing: ListingOut;
      can_undo: boolean;
      favorites_count?: number;
      favorites_max?: number | null;
    }>("/swipe/undo", {
      method: "POST",
    }),
  resetPasses: () =>
    request<{ ok: boolean; cleared: number }>("/feed/reset-passes", { method: "POST" }),
  favorites: () => request<ListingOut[]>("/favorites"),
  shareFavorites: () =>
    request<{ ok: boolean; sent: number }>("/favorites/share", { method: "POST" }),
  removeFavorite: (listingId: number) =>
    request<{
      ok: boolean;
      is_favorite?: boolean;
      favorites_count?: number;
      favorites_max?: number | null;
    }>(`/favorites/${listingId}`, { method: "DELETE" }),
  hideListing: (listingId: number) =>
    request<{ ok: boolean; hidden: boolean }>(`/hidden/${listingId}`, {
      method: "POST",
    }),
  searchStatus: (taskId: string) => request<SearchTaskResult>(`/search/${taskId}`),
  nlpExtract: (text: string, defaultCity?: string) =>
    request<{
      params: SearchParams;
      raw_query: string;
      needs_clarification?: boolean;
      clarification_question?: string | null;
    }>("/nlp/extract", {
      method: "POST",
      body: JSON.stringify({ text, default_city: defaultCity }),
    }),
  nlpVoice: async (blob: Blob) => {
    const fd = new FormData();
    fd.append("audio", blob, "voice.webm");
    return request<{
      transcript: string;
      params: SearchParams;
      raw_query: string;
      needs_clarification?: boolean;
      clarification_question?: string | null;
    }>("/nlp/voice", {
      method: "POST",
      body: fd,
    });
  },
  setFavoritePriceAlert: (listingId: number, enabled: boolean) =>
    request<{ ok: boolean; notify_price_drop: boolean }>(
      `/favorites/${listingId}/price-alert`,
      { method: "PUT", body: JSON.stringify({ enabled }) }
    ),
  createInvoice: () =>
    request<{
      ok: boolean;
      dev: boolean;
      invoice_url: string | null;
      stars?: number;
    }>("/payments/invoice", {
      method: "POST",
    }),
  claimChannelBonus: () =>
    request<ChannelBonusResult>("/me/channel-bonus", { method: "POST" }),
};
