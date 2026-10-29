import { useEffect, useRef, useState } from "react";

type GeoZone = { type: "Polygon"; coordinates: number[][][] };

type Props = {
  city?: string | null;
  value?: GeoZone | null;
  onChange: (zone: GeoZone | null) => void;
};

type LeafletMap = {
  remove: () => void;
  on: (ev: string, cb: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  eachLayer: (cb: (layer: { remove?: () => void; getAttribution?: () => string }) => void) => void;
  removeLayer: (layer: unknown) => void;
  fitBounds: (b: unknown, o?: object) => void;
  invalidateSize: () => void;
};

type LeafletNS = {
  map: (el: HTMLElement, opts: object) => LeafletMap & {
    setView: (c: [number, number], z: number) => LeafletMap;
    addLayer?: (l: unknown) => void;
  };
  tileLayer: (url: string, opts: object) => { addTo: (m: unknown) => unknown; getAttribution: () => string };
  polygon: (latlngs: [number, number][], opts: object) => {
    addTo: (m: unknown) => unknown;
    getBounds: () => unknown;
  };
  circleMarker: (ll: [number, number], opts: object) => { addTo: (m: unknown) => unknown };
};

declare global {
  interface Window {
    L?: LeafletNS;
  }
}

const CITY_CENTER: Record<string, [number, number]> = {
  Москва: [55.7558, 37.6173],
  "Санкт-Петербург": [59.9343, 30.3351],
};

let leafletPromise: Promise<LeafletNS> | null = null;

function loadLeaflet(): Promise<LeafletNS> {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () =>
      window.L ? resolve(window.L) : reject(new Error("Leaflet missing"));
    script.onerror = () => reject(new Error("Leaflet load error"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export function ZoneMapPicker({ city, value, onChange }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const pointsRef = useRef<[number, number][]>([]);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("Тапайте по карте — минимум 3 точки");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapEl.current) return;
        const center = CITY_CENTER[city || "Москва"] || CITY_CENTER["Москва"];
        const map = L.map(mapEl.current, { zoomControl: true, attributionControl: false }).setView(
          center,
          11
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(
          map
        );
        mapRef.current = map;

        const existing = value?.coordinates?.[0];
        if (existing && existing.length >= 3) {
          const latlngs = existing.map((p) => [p[1], p[0]] as [number, number]);
          pointsRef.current = latlngs.slice(0, -1);
          const poly = L.polygon(latlngs, {
            color: "#e83466",
            weight: 2,
            fillOpacity: 0.18,
          });
          poly.addTo(map);
          layerRef.current = poly;
          map.fitBounds(poly.getBounds(), { padding: [24, 24] });
          setHint(`Зона задана · ${pointsRef.current.length} точек`);
        }

        map.on("click", (e) => {
          const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
          pointsRef.current = [...pointsRef.current, pt];
          const marker = L.circleMarker(pt, { radius: 5, color: "#e83466" });
          marker.addTo(map);
          markersRef.current.push(marker);

          if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
          }
          if (pointsRef.current.length >= 3) {
            const closed = [...pointsRef.current, pointsRef.current[0]];
            const poly = L.polygon(closed, {
              color: "#e83466",
              weight: 2,
              fillOpacity: 0.18,
            });
            poly.addTo(map);
            layerRef.current = poly;
            const ring = closed.map(([lat, lon]) => [lon, lat]);
            onChangeRef.current({ type: "Polygon", coordinates: [ring] });
            setHint(`Зона: ${pointsRef.current.length} точек`);
          } else {
            setHint(`Точек: ${pointsRef.current.length} (нужно ≥ 3)`);
          }
        });

        setReady(true);
        window.setTimeout(() => map.invalidateSize(), 100);
      } catch {
        setHint("Не удалось загрузить карту");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // only remount when city changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  function clearZone() {
    const map = mapRef.current;
    if (map) {
      if (layerRef.current) map.removeLayer(layerRef.current);
      for (const m of markersRef.current) map.removeLayer(m);
    }
    layerRef.current = null;
    markersRef.current = [];
    pointsRef.current = [];
    onChange(null);
    setHint("Тапайте по карте — минимум 3 точки");
  }

  return (
    <div className="zone-map">
      <p className="muted zone-map-hint">{hint}</p>
      <div ref={mapEl} className="zone-map-canvas" />
      <div className="zone-map-actions">
        <button type="button" className="btn" disabled={!ready} onClick={clearZone}>
          Очистить зону
        </button>
      </div>
    </div>
  );
}
