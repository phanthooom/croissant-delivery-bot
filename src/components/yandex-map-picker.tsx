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
  if (window.ymaps?.geocode) {
    return new Promise<void>((r) => window.ymaps.ready(r));
  }
  window.__ymapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=${lang}`;
    script.async = true;
    script.onload = () => window.ymaps.ready(resolve);
    script.onerror = () => reject(new Error("Yandex Maps load error"));
    document.head.appendChild(script);
  });
  return window.__ymapsLoading;
}

interface Props {
  initialCoords?: { lat: number; lon: number };
  apiKey: string;
  lang?: string;
  saveLabel?: string;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address, setAddress] = useState(detectingLabel);
  const [coords, setCoords] = useState(initialCoords ?? TASHKENT);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");

  const geocode = useCallback(async (lat: number, lon: number) => {
    setGeocoding(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (window.ymaps as any).geocode([lat, lon], { results: 1, kind: "house" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const first = (res as any).geoObjects.get(0);
      const text: string = first?.getAddressLine?.() ?? "";
      setAddress(text || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } finally {
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    loadYmaps(apiKey, lang)
      .then(() => {
        if (destroyed || !containerRef.current || mapRef.current) return;

        const center: [number, number] = [coords.lat, coords.lon];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new (window.ymaps as any).Map(
          containerRef.current,
          { center, zoom: 16, controls: [] },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        // zoom control
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.controls.add(new (window.ymaps as any).control.ZoomControl({
          options: { position: { right: 16, top: 80 } },
        }));

        void geocode(coords.lat, coords.lon);

        map.events.add("actiontick", () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setAddress(detectingLabel);
        });

        map.events.add("actionend", () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          const [lat, lon]: [number, number] = map.getCenter();
          setCoords({ lat, lon });
          timerRef.current = setTimeout(() => void geocode(lat, lon), 350);
        });
      })
      .catch(() => {
        if (!destroyed) setError("Не удалось загрузить карту");
      });

    return () => {
      destroyed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Map fills screen */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-start gap-3 p-4"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-[var(--app-text)]"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.22)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div
          className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold leading-snug"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.22)" }}
        >
          {geocoding
            ? <span className="text-[var(--app-text-soft)]">{detectingLabel}</span>
            : <span className="text-[var(--app-text)]">{address}</span>}
        </div>
      </div>

      {/* Fixed center pin */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex flex-col items-center" style={{ transform: "translateY(-28px)" }}>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "#1c1c1e", boxShadow: "0 4px 18px rgba(0,0,0,0.35)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="3.5" r="2" fill="white" />
              <path d="M8.5 9.5C9.5 8 11 7.5 12 7.5s2.5.5 3.5 2L17 13h-2.5l-.5 4.5h-4L9.5 13H7l1.5-3.5z" fill="white" />
              <path d="M9.5 13.5L8 17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M14.5 13.5L16 17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-[3px] h-4 bg-[#1c1c1e]" style={{ borderRadius: "0 0 2px 2px" }} />
          <div className="w-3 h-3 rounded-full bg-[#e63946]" style={{ boxShadow: "0 0 0 4px rgba(230,57,70,0.22)" }} />
        </div>
      </div>

      {error && (
        <div className="absolute inset-x-4 top-24 z-20 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600 text-center">
          {error}
        </div>
      )}

      {/* Save button */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 p-4"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)` }}
      >
        <button
          type="button"
          disabled={geocoding}
          onClick={() => onSave(address === detectingLabel ? "" : address, coords)}
          className="w-full rounded-[16px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.22)" }}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
