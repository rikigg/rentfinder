import type { ListingOut } from "../types";

const SOURCE_LABEL: Record<string, string> = {
  yandex: "Яндекс",
  cian: "Циан",
  avito: "Авито",
  domclick: "Домклик",
  telegram: "Telegram",
};

export function sourceLabel(src: string) {
  return SOURCE_LABEL[src] || src;
}

/** e.g. "Циан · Яндекс · +1" */
export function sourcesBadge(item: ListingOut): string | null {
  const list =
    item.sources?.length
      ? item.sources
      : item.source_urls?.length
        ? [...new Set(item.source_urls.map((s) => s.source))]
        : [item.source];
  if (list.length <= 1) return null;
  const labels = list.map(sourceLabel);
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} · +${labels.length - 2}`;
}
