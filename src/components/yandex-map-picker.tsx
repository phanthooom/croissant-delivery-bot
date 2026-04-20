"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback } from "react";

const TASHKENT = { lat: 41.2995, lon: 69.2401 };

interface Props {
  initialCoords?: { lat: number; lon: number };
  saveLabel?: string;
  detectingLabel?: string;
  onSave: (address: string, coords: { lat: number; lon: number }) => void;
  onClose: () => void;
}

export default function FullscreenMapPicker({
  initialCoords,
  saveLabel = "Сохранить",
  detectingLabel = "Определение адреса…",
  onSave,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address, setAddress] = useState(detectingLabel);
  const [coords, setCoords] = useState(initialCoords ?? TASHKENT);
  const [geocoding, setGeocoding] = useState(false);

  const geocode = useCallback(async (lat: number, lon: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ru`,
        { headers: { "User-Agent": "CroissantMiniApp/1.0" } },
      );
      const data = await res.json() as {
        display_name?: string;
        address?: {
          road?: string; pedestrian?: string; footway?: string;
          house_number?: string; suburb?: string; neighbourhood?: string;
          city?: string; town?: string; village?: string;
        };
      };
      const a = data.address ?? {};
      const street = a.road ?? a.pedestrian ?? a.footway;
      const parts = [street, a.house_number, a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.village].filter(Boolean);
      setAddress(parts.length ? parts.join(", ") : (data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`));
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } finally {
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    import("leaflet").then((L) => {
      if (destroyed || !containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const center: [number, number] = [coords.lat, coords.lon];
      const map = L.map(containerRef.current!, {
        center,
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Yandex-like tile layer via OSM
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Zoom control (top-right)
      L.control.zoom({ position: "topright" }).addTo(map);

      mapRef.current = map;
      void geocode(coords.lat, coords.lon);

      map.on("movestart", () => {
        if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
        setAddress(detectingLabel);
      });

      map.on("moveend", () => {
        if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
        const c = map.getCenter();
        const lat = c.lat;
        const lon = c.lng;
        setCoords({ lat, lon });
        geocodeTimerRef.current = setTimeout(() => void geocode(lat, lon), 400);
      });
    });

    return () => {
      destroyed = true;
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-start gap-3 p-4"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)` }}
      >
        {/* Back */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-[var(--app-text)]"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.20)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Address bubble */}
        <div
          className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--app-text)] leading-snug"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.20)" }}
        >
          {geocoding
            ? <span className="text-[var(--app-text-soft)]">{detectingLabel}</span>
            : address}
        </div>
      </div>

      {/* Fixed center pin */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex flex-col items-center" style={{ transform: "translateY(-28px)" }}>
          {/* dark rounded square with person icon */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "#1c1c1e", boxShadow: "0 4px 18px rgba(0,0,0,0.35)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="3.5" r="2" fill="white" />
              <path
                d="M8.5 9.5C9.5 8 11 7.5 12 7.5s2.5.5 3.5 2L17 13h-2.5l-.5 4.5h-4L9.5 13H7l1.5-3.5z"
                fill="white"
              />
              <path d="M9.5 13.5L8 17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M14.5 13.5L16 17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          {/* stem */}
          <div className="w-[3px] h-4 bg-[#1c1c1e]" style={{ borderRadius: "0 0 2px 2px" }} />
          {/* anchor dot */}
          <div
            className="w-3 h-3 rounded-full bg-[#e63946]"
            style={{ boxShadow: "0 0 0 4px rgba(230,57,70,0.22)" }}
          />
        </div>
      </div>

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
