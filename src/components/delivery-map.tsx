"use client";

import { useEffect, useRef } from "react";

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
  if (window.ymaps?.Placemark) return new Promise<void>((r) => window.ymaps.ready(r));
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

interface DeliveryMapProps {
  restaurantLat: number;
  restaurantLon: number;
  customerLat: number;
  customerLon: number;
  courierLat: number;
  courierLon: number;
  step: number;
  apiKey: string;
  lang?: string;
}

export default function DeliveryMap({
  restaurantLat, restaurantLon,
  customerLat, customerLon,
  courierLat, courierLon,
  step: _step,
  apiKey,
  lang = "ru_RU",
}: DeliveryMapProps) {
  void _step;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courierMarkRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeDoneRef = useRef<any>(null);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    loadYmaps(apiKey, lang).then(() => {
      if (destroyed || !containerRef.current || mapRef.current) return;
      const Y = window.ymaps;

      const midLat = (restaurantLat + customerLat) / 2;
      const midLon = (restaurantLon + customerLon) / 2;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = new Y.Map(containerRef.current, {
        center: [midLat, midLon],
        zoom: 14,
        controls: [],
      }, { suppressMapOpenBlock: true });

      mapRef.current = map;

      // ── Restaurant pin ────────────────────────────────────────────────────
      map.geoObjects.add(new Y.Placemark(
        [restaurantLat, restaurantLon],
        {},
        {
          iconLayout: "default#imageWithContent",
          iconImageHref: "",
          iconContentLayout: Y.templateLayoutFactory.createClass(
            `<div style="
              width:36px;height:36px;border-radius:50%;
              background:#1c1c1e;border:2px solid white;
              display:flex;align-items:center;justify-content:center;
              font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">🏪</div>`,
          ),
          iconImageSize: [36, 36],
          iconImageOffset: [-18, -36],
        },
      ));

      // ── Customer pin ──────────────────────────────────────────────────────
      map.geoObjects.add(new Y.Placemark(
        [customerLat, customerLon],
        {},
        {
          iconLayout: "default#imageWithContent",
          iconImageHref: "",
          iconContentLayout: Y.templateLayoutFactory.createClass(
            `<div style="display:flex;flex-direction:column;align-items:center;">
              <div style="
                width:36px;height:36px;border-radius:50%;
                background:#2f7f5b;border:2px solid white;
                display:flex;align-items:center;justify-content:center;
                font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);
              ">🏠</div>
              <div style="width:2px;height:8px;background:#2f7f5b;"></div>
            </div>`,
          ),
          iconImageSize: [36, 44],
          iconImageOffset: [-18, -44],
        },
      ));

      // ── Route polyline ────────────────────────────────────────────────────
      map.geoObjects.add(new Y.Polyline(
        [[restaurantLat, restaurantLon], [customerLat, customerLon]],
        {},
        { strokeColor: "#aaaaaa", strokeWidth: 3, strokeStyle: "dash" },
      ));

      // ── Completed route overlay ───────────────────────────────────────────
      const routeDone = new Y.Polyline(
        [[restaurantLat, restaurantLon], [courierLat, courierLon]],
        {},
        { strokeColor: "#1c1c1e", strokeWidth: 4 },
      );
      map.geoObjects.add(routeDone);
      routeDoneRef.current = routeDone;

      // ── Courier marker ────────────────────────────────────────────────────
      const courierMark = new Y.Placemark(
        [courierLat, courierLon],
        {},
        {
          iconLayout: "default#imageWithContent",
          iconImageHref: "",
          iconContentLayout: Y.templateLayoutFactory.createClass(
            `<div style="
              font-size:26px;
              filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));
            ">🚗</div>`,
          ),
          iconImageSize: [32, 32],
          iconImageOffset: [-16, -16],
        },
      );
      map.geoObjects.add(courierMark);
      courierMarkRef.current = courierMark;

      // Fit bounds
      const bounds = Y.util.bounds.fromPoints([
        [restaurantLat, restaurantLon],
        [customerLat, customerLon],
        [courierLat, courierLon],
      ]);
      map.setBounds(bounds, { checkZoomRange: true, duration: 0, padding: [28, 28, 28, 28] });
    }).catch(() => { /* map unavailable */ });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
        courierMarkRef.current = null;
        routeDoneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update courier position ───────────────────────────────────────────────
  useEffect(() => {
    if (!courierMarkRef.current) return;
    courierMarkRef.current.geometry.setCoordinates([courierLat, courierLon]);
    if (mapRef.current) {
      mapRef.current.panTo([courierLat, courierLon], { flying: true, duration: 800 });
    }
  }, [courierLat, courierLon]);

  // ── Update completed route segment ───────────────────────────────────────
  useEffect(() => {
    if (!routeDoneRef.current) return;
    routeDoneRef.current.geometry.setCoordinates([
      [restaurantLat, restaurantLon],
      [courierLat, courierLon],
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(courierLat * 1000), Math.round(courierLon * 1000)]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
