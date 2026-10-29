import { isPlausibleAddress } from "../lib/maps";
import { parseDescription } from "../lib/parseDescription";
import { renovationLabel } from "../lib/renovation";
import { sourceLabel } from "../lib/sources";
import type { ListingOut } from "../types";

type Fact = { label: string; value: string };

function roomsLabel(rooms: number | null | undefined): string | null {
  if (rooms == null) return null;
  if (rooms === 0) return "Студия";
  return `${rooms}-комн.`;
}

function floorLabel(listing: ListingOut): string | null {
  if (listing.floor == null) return null;
  return listing.floors_total
    ? `${listing.floor} из ${listing.floors_total}`
    : `${listing.floor}`;
}

function petsLabel(v: boolean | null | undefined): string | null {
  if (v === true) return "Можно";
  if (v === false) return "Нельзя";
  return null;
}

export function ListingDescription({ listing }: { listing: ListingOut }) {
  const raw = listing.description_rewritten || listing.title || "";
  const parsed = parseDescription(raw);

  const facts: Fact[] = [];
  const rooms = roomsLabel(listing.rooms);
  if (rooms) facts.push({ label: "Тип", value: rooms });
  if (listing.area != null) facts.push({ label: "Площадь", value: `${listing.area} м²` });
  const floor = floorLabel(listing);
  if (floor) facts.push({ label: "Этаж", value: floor });
  const reno = renovationLabel(listing.renovation);
  if (reno) facts.push({ label: "Ремонт", value: reno });
  if (parsed.moveIn) facts.push({ label: "Заезд", value: parsed.moveIn });
  if (parsed.term) facts.push({ label: "Срок", value: parsed.term });
  if (parsed.building) facts.push({ label: "Дом", value: parsed.building });
  if (parsed.windows) facts.push({ label: "Окна", value: parsed.windows });
  const pets = petsLabel(listing.pets_allowed);
  if (pets) facts.push({ label: "Животные", value: pets });
  if (listing.source) facts.push({ label: "Источник", value: sourceLabel(listing.source) });

  const hasContent =
    facts.length > 0 ||
    listing.address ||
    listing.complex_name ||
    listing.metro ||
    parsed.appliances.length > 0 ||
    parsed.body;

  if (!hasContent) {
    return <p className="ldesc-empty">Описание отсутствует</p>;
  }

  return (
    <div className="ldesc">
      {facts.length > 0 ? (
        <section className="ldesc-section">
          <h4 className="ldesc-title">Параметры</h4>
          <div className="ldesc-facts">
            {facts.map((f) => (
              <div key={f.label} className="ldesc-fact">
                <span className="ldesc-fact-label">{f.label}</span>
                <span className="ldesc-fact-value">{f.value}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {listing.metro || listing.address || listing.complex_name ? (
        <section className="ldesc-section">
          <h4 className="ldesc-title">Расположение</h4>
          <div className="ldesc-place">
            {listing.metro ? (
              <div className="ldesc-place-row">
                <span className="ldesc-place-ico" aria-hidden>
                  M
                </span>
                <span>
                  {listing.metro}
                  {listing.metro_walk_min != null
                    ? ` · ${listing.metro_walk_min} мин пешком`
                    : ""}
                </span>
              </div>
            ) : null}
            {listing.complex_name ? (
              <div className="ldesc-place-row">
                <span className="ldesc-place-ico" aria-hidden>
                  ЖК
                </span>
                <span>{listing.complex_name}</span>
              </div>
            ) : null}
            {isPlausibleAddress(listing.address) ? (
              <div className="ldesc-place-row">
                <span className="ldesc-place-ico" aria-hidden>
                  ⌖
                </span>
                <span>{listing.address}</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {parsed.appliances.length > 0 ? (
        <section className="ldesc-section">
          <h4 className="ldesc-title">Техника и удобства</h4>
          <div className="ldesc-chips">
            {parsed.appliances.map((a) => (
              <span key={a} className="ldesc-chip">
                {a}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {parsed.body ? (
        <section className="ldesc-section">
          <h4 className="ldesc-title">О квартире</h4>
          <p className="ldesc-body">{parsed.body}</p>
        </section>
      ) : null}
    </div>
  );
}
