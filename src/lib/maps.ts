import type { ListingOut } from "../types";

/** Reject seller/marketing strings that were stored as address. */
export function isPlausibleAddress(addr: string | null | undefined): boolean {
  if (!addr) return false;
  const text = addr.trim().replace(/^[📍.\s]+/, "").replace(/[.\s]+$/, "");
  if (text.length < 5 || text.length > 120) return false;
  if (/^(?:м\.|метро)\b/i.test(text)) return false;
  if (
    /^(?:собственник\w*|агент\w*|риэлтор\w*|риелтор\w*|без\s+комиссии|комиссия|торг|залог|вс[её]\s+необходим\w*(?:\s+рядом)?|необходим\w*\s+рядом|рядом|инфраструктура|долгосрочн\w*|посуточн\w*|сдам\w*|сда[её]тся|фото|описание|контакт\w*|писать|звонить|студия|квартира|апартамент\w*|комната|мебель|техника|ремонт)\.?$/i.test(
      text
    )
  ) {
    return false;
  }
  if (/^(?:сдам|сда[её]тся|сдается|прода[её]тся|продам)\b/i.test(text)) {
    return false;
  }
  const words = text.match(/[A-Za-zА-Яа-яЁё0-9\-]+/g) || [];
  if (words.length <= 1 && !/\d/.test(text)) return false;
  if (
    /(?:\bулица\b|\bул\.\b|\bпроспект\b|\bпр-?кт\.?\b|\bпр-?т\.\b|\bпроезд\b|\bпр-д\b|\bпер\.\b|\bпереулок\b|\bбул\.\b|\bбульвар\b|\bнаб\.\b|\bнабережная\b|\bшоссе\b|\bб-р\b|\bд\.\b|\bдом\b|\bкв\.\b|\bкорп\.?\b|\bстроение\b|\d)/i.test(
      text
    )
  ) {
    return true;
  }
  if (/^жк\b/i.test(text) && text.length <= 60) return true;
  const words2 = text.match(/[A-Za-zА-Яа-яЁё0-9\-]+/g) || [];
  return (
    text.length >= 8 &&
    text.length <= 45 &&
    words2.length <= 3 &&
    !/[.!?]/.test(text) &&
    !/\b(?:работаю|ищу|ищем|живу|снимаю|рядом|район|метро)\b/i.test(text)
  );
}

/** Best text query for Yandex Maps when coords are missing. */
export function mapSearchText(listing: ListingOut): string | null {
  const city = (listing.city || "").trim();
  if (isPlausibleAddress(listing.address)) {
    const addr = listing.address!.trim();
    return city && !addr.toLowerCase().includes(city.toLowerCase())
      ? `${addr}, ${city}`
      : addr;
  }
  if (listing.complex_name) {
    const jk = listing.complex_name.trim();
    const base = /^жк\b/i.test(jk) ? jk : `ЖК ${jk}`;
    return city ? `${base}, ${city}` : base;
  }
  if (listing.metro) {
    return city
      ? `метро ${listing.metro}, ${city}`
      : `метро ${listing.metro}`;
  }
  return null;
}

export function mapUrl(listing: ListingOut): string | null {
  if (listing.lat != null && listing.lon != null) {
    return `https://yandex.ru/maps/?pt=${listing.lon},${listing.lat}&z=16&l=map`;
  }
  const text = mapSearchText(listing);
  if (!text) return null;
  return `https://yandex.ru/maps/?text=${encodeURIComponent(text)}`;
}

/** Line under metro on cards — real address or ЖК, never junk. */
export function locationLabel(listing: ListingOut): string | null {
  if (isPlausibleAddress(listing.address)) return listing.address;
  if (listing.complex_name) {
    const jk = listing.complex_name.trim();
    return /^жк\b/i.test(jk) ? jk : `ЖК ${jk}`;
  }
  return null;
}
