export type SourceName = "cian" | "avito" | "domclick" | "yandex" | "telegram";

export type CianPlatformFilters = {
  is_by_homeowner?: boolean | null;
  metro_foot_minute?: number | null;
  min_house_year?: number | null;
  max_house_year?: number | null;
  have_loggia?: boolean | null;
};

export type AvitoPlatformFilters = {
  query_extra?: string | null;
};

export type YandexPlatformFilters = {
  metro_on_foot?: boolean | null;
};

export type DomclickPlatformFilters = {
  only_apartments?: boolean | null;
};

export type PlatformFilters = {
  cian?: CianPlatformFilters | null;
  avito?: AvitoPlatformFilters | null;
  yandex?: YandexPlatformFilters | null;
  domclick?: DomclickPlatformFilters | null;
};

/** Walk time to metro (common filter). */
export type MetroWalk = "upto_5" | "upto_15" | "upto_30" | "from_30";

export type SearchParams = {
  city?: string | null;
  property_type?: string | null;
  rooms?: number[] | null;
  price_min?: number | null;
  price_max?: number | null;
  area_min?: number | null;
  area_max?: number | null;
  metro?: string[] | null;
  /** Пешком до метро */
  metro_walk?: MetroWalk | null;
  district?: string | null;
  pets_allowed?: boolean | null;
  floor_min?: number | null;
  floor_max?: number | null;
  renovation?: string[] | null;
  keywords?: string[];
  raw_query?: string | null;
  sources?: SourceName[] | null;
  platform?: PlatformFilters | null;
  /** GeoJSON Polygon: coordinates = [[[lon, lat], ...]] */
  geo_zone?: { type: "Polygon"; coordinates: number[][][] } | null;
};

export type NotifyMode = "off" | "on_new" | "1h" | "12h" | "24h";

export type FilterOut = {
  id: number;
  name: string | null;
  params: SearchParams;
  raw_query: string | null;
  notify_enabled: boolean;
  notify_mode: NotifyMode;
  last_notified_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type ViewMode = "deck" | "browse";

export type UserOut = {
  id: number;
  tg_id: number;
  username: string | null;
  city: string;
  free_parses_left: number;
  trial_listings_left: number;
  channel_bonus_claimed?: boolean;
  subscription_until: string | null;
  view_mode?: ViewMode | null;
  is_active: boolean;
};

export type MeFeatures = {
  telegram_parse?: boolean;
  payments_dev?: boolean;
  nlp_query?: boolean;
  /** Which aggregators actually scrape */
  sources?: Partial<Record<SourceName, boolean>>;
  /** Show all platform chips as non-parseable dummies */
  sources_showcase?: boolean;
};

export type AdPlacement = {
  image_url: string | null;
  click_url: string | null;
};

export type AdsCampaign = {
  enabled: boolean;
  frequency: number;
  deck?: AdPlacement;
  browse?: AdPlacement;
  /** @deprecated legacy flat fields — prefer deck */
  image_url?: string | null;
  click_url?: string | null;
};

export type PlanTier = "trial" | "pro" | "premium";

export type TrialLimits = {
  daily_swipes: number;
  channel_bonus_swipes: number;
  favorites_max: number;
};

export type MeOut = {
  user: UserOut;
  has_subscription: boolean;
  is_admin?: boolean;
  plan?: PlanTier;
  active_filter: FilterOut | null;
  filters: FilterOut[];
  last_task_id: string | null;
  last_task_status: string | null;
  last_task_results_count: number;
  unseen_count: number;
  can_undo: boolean;
  subscription_price: number;
  subscription_stars?: number;
  tribute_url?: string;
  trial_listings_total: number;
  swipes_left?: number;
  swipes_total?: number;
  favorites_count?: number;
  favorites_max?: number | null;
  trial_limits?: TrialLimits;
  channel_url?: string;
  channel_bonus_amount?: number;
  channel_bonus_claimed?: boolean;
  bot_username: string | null;
  features?: MeFeatures;
  ads?: AdsCampaign;
};

export type ChannelBonusResult = {
  ok: boolean;
  subscribed: boolean;
  bonus_granted: boolean;
  already_claimed: boolean;
  bonus_amount: number;
  trial_listings_left: number;
  channel_url: string;
  check_error?: string | null;
};

export type PayMethod = "stars" | "tribute";

export type SwipeResult = {
  ok: boolean;
  can_undo: boolean;
  direction?: string;
  swipes_left?: number;
  swipes_total?: number;
  trial_listings_left?: number;
  trial_ended?: boolean;
  favorites_count?: number;
  favorites_max?: number | null;
};

export type BrowseOpenResult = {
  ok: boolean;
  charged: boolean;
  trial_listings_left: number;
  trial_ended: boolean;
  swipes_left?: number;
  swipes_total?: number;
};

export type SourceUrl = { source: string; url: string; id: number };

export type MoveInTerms = {
  rent?: number | null;
  deposit?: number | null;
  commission_pct?: number | null;
  commission_rub?: number | null;
  utilities_note?: string | null;
  total?: number | null;
  source?: "yandex" | "parsed_text" | "estimate";
};

export type ListingOut = {
  id: number;
  source: string;
  url: string;
  title: string | null;
  description_rewritten: string | null;
  price: number | null;
  rooms: number | null;
  area: number | null;
  floor: number | null;
  floors_total: number | null;
  address: string | null;
  metro: string | null;
  metro_walk_min: number | null;
  city: string | null;
  pets_allowed: boolean | null;
  renovation: string | null;
  complex_name?: string | null;
  lat?: number | null;
  lon?: number | null;
  photos: string[] | null;
  published_at: string | null;
  group_id?: number | null;
  source_urls?: SourceUrl[];
  source_count?: number;
  sources?: string[];
  seller_type?: "owner" | "agent" | null;
  move_in?: MoveInTerms | null;
  is_favorite?: boolean;
  notify_price_drop?: boolean;
  price_at_save?: number | null;
  price_dropped?: boolean;
  price_drop_amount?: number | null;
};

export type AdCard = {
  kind: "ad";
  id: string;
  image_url: string;
  click_url: string | null;
};

export type DeckCard = ListingOut | AdCard;

export function isAdCard(card: DeckCard): card is AdCard {
  return (card as AdCard).kind === "ad";
}

export type ActiveFilterResponse = {
  filter: FilterOut;
  task_id: string | null;
  status: string | null;
  quota_error: boolean;
};

export type SearchTaskResult = {
  task_id: string;
  status: string;
  results_count: number;
  listing_ids: number[];
  failed_sources: string[];
  error: string | null;
};

export type Screen =
  | "loading"
  | "onboarding"
  | "modePick"
  | "settings"
  | "subscription"
  | "filters"
  | "waiting"
  | "deck"
  | "browse"
  | "favorites"
  | "paywall";
