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
  if (window.ymaps?.geocode) return new Promise<void>((r) => window.ymaps.ready(r));
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
  topOffset?: number;
  saveLabel?: string;
  detectingLabel?: string;
  detectLocationLabel?: string;
  onSave: (address: string, coords: { lat: number; lon: number }) => void;
  onClose: () => void;
}

export default function YandexMapPicker({
  initialCoords,
  apiKey,
  lang = "ru_RU",
  topOffset = 16,
  saveLabel = "Сохранить",
  detectingLabel = "Определение адреса…",
  detectLocationLabel = "Моё местоположение",
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
  const [locating, setLocating] = useState(false);
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

  function panTo(lat: number, lon: number) {
    if (!mapRef.current) return;
    mapRef.current.setCenter([lat, lon], 16, { duration: 400 });
  }

  function detectLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        panTo(lat, lon);
        setLocating(false);
      },
      () => {
        setError("Не удалось определить геолокацию");
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

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

  const topPx = topOffset + 12;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar — pushed down by topOffset to clear Telegram header */}
      <div
        className="absolute left-0 right-0 z-10 flex items-center gap-3 px-4"
        style={{ top: topPx }}
      >
        {/* Back button */}
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

        {/* Address bubble */}
        <div
          className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold leading-snug"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.22)" }}
        >
          {geocoding
            ? <span className="text-[var(--app-text-soft)]">{detectingLabel}</span>
            : <span className="text-[var(--app-text)]">{address}</span>}
        </div>
      </div>

      {/* GPS button — right side, below top bar */}
      <button
        type="button"
        disabled={locating}
        onClick={detectLocation}
        className="absolute z-10 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white disabled:opacity-60"
        style={{ top: topPx + 56, boxShadow: "0 2px 12px rgba(0,0,0,0.22)" }}
        title={detectLocationLabel}
      >
        {locating ? (
          <svg className="animate-spin h-5 w-5 text-[var(--app-accent)]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.5" stroke="var(--app-accent)" strokeWidth="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="var(--app-accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

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
          <div
            className="w-3 h-3 rounded-full bg-[#e63946]"
            style={{ boxShadow: "0 0 0 4px rgba(230,57,70,0.22)" }}
          />
        </div>
      </div>

      {error && (
        <div className="absolute inset-x-4 z-20 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600 text-center"
          style={{ top: topPx + 68 }}>
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
