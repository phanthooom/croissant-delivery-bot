"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const TASHKENT = { lat: 41.2995, lon: 69.2401 };

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ymaps: any;
    __ymapsLoading?: Promise<void>;
  }
}

function loadYmaps(apiKey: string, lang: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__ymapsLoading) return window.__ymapsLoading;
  if (window.ymaps?.ready) {
    return new Promise<void>((resolve) => window.ymaps.ready(resolve));
  }
  window.__ymapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=${lang}`;
    script.async = true;
    script.onload = () => window.ymaps.ready(resolve);
    script.onerror = () => reject(new Error("Yandex Maps failed to load"));
    document.head.appendChild(script);
  });
  return window.__ymapsLoading;
}

interface Props {
  initialCoords?: { lat: number; lon: number };
  apiKey: string;
  lang?: string;
  saveLabel?: string;
  searchLabel?: string;
  detectingLabel?: string;
  onSave: (address: string, coords: { lat: number; lon: number }) => void;
  onClose: () => void;
}

export default function YandexMapPicker({
  initialCoords,
  apiKey,
  lang = "ru_RU",
  saveLabel = "Сохранить",
  detectingLabel = "Определение адреса…",
  onSave,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address, setAddress] = useState(detectingLabel);
  const [coords, setCoords] = useState(initialCoords ?? TASHKENT);
  const [loadError, setLoadError] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  const geocode = useCallback(
    async (lat: number, lon: number) => {
      setGeocoding(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window.ymaps as any).geocode([lat, lon], {
          results: 1,
          kind: "house",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const first = (result as any).geoObjects.get(0);
        if (first) {
          const text: string = first.getAddressLine?.() ?? "";
          setAddress(text || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        } else {
          setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        }
      } catch {
        setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } finally {
        setGeocoding(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    loadYmaps(apiKey, lang)
      .then(() => {
        if (destroyed || !containerRef.current || mapRef.current) return;

        const center = [coords.lat, coords.lon] as [number, number];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new (window.ymaps as any).Map(
          containerRef.current,
          { center, zoom: 16, controls: [] },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        void geocode(coords.lat, coords.lon);

        // Debounce geocoding while dragging
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.events.add("actiontick", () => {
          if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
          setAddress(detectingLabel);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.events.add("actionend", () => {
          if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
          const [lat, lon]: [number, number] = map.getCenter();
          setCoords({ lat, lon });
          geocodeTimerRef.current = setTimeout(() => void geocode(lat, lon), 300);
        });
      })
      .catch(() => {
        if (!destroyed) setLoadError("Не удалось загрузить карту");
      });

    return () => {
      destroyed = true;
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Map fills everything */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── Top controls overlay ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start gap-3 p-4 pointer-events-none"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)` }}>
        {/* Back button */}
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white shadow-lg text-[var(--app-text)]"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Address bubble */}
        <div className="pointer-events-none flex-1">
          <div
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] leading-snug"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}
          >
            {geocoding ? (
              <span className="text-[var(--app-text-soft)]">{detectingLabel}</span>
            ) : (
              address
            )}
          </div>
        </div>
      </div>

      {/* ── Fixed center pin ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex flex-col items-center" style={{ transform: "translateY(-28px)" }}>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "#1a1a1a", boxShadow: "0 4px 16px rgba(0,0,0,0.35)" }}
          >
            {/* walking person icon */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="4" r="2" fill="white" />
              <path d="M10.5 8.5L8 14h2.5l1 4h1l1-4H16L13.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M10 11.5l-1.5 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13.5 11.5l1.5 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          {/* stem */}
          <div className="w-0.5 h-4 bg-[#1a1a1a]" />
          {/* dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-[#e63946]" style={{ boxShadow: "0 0 0 3px rgba(230,57,70,0.25)" }} />
        </div>
      </div>

      {/* ── Error state ── */}
      {loadError && (
        <div className="absolute inset-x-4 top-24 z-20 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600 text-center">
          {loadError}
        </div>
      )}

      {/* ── Save button ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 p-4"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)` }}
      >
        <button
          type="button"
          onClick={() => onSave(address === detectingLabel ? "" : address, coords)}
          disabled={geocoding || !!loadError}
          className="w-full rounded-[16px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition-all active:scale-95 disabled:opacity-50"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
