"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

interface DeliveryMapProps {
  restaurantLat: number;
  restaurantLon: number;
  customerLat: number;
  customerLon: number;
  courierLat: number;
  courierLon: number;
  step: number; // 1=picked, 2=delivering, 3=delivered
}

export default function DeliveryMap({
  restaurantLat, restaurantLon,
  customerLat, customerLon,
  courierLat, courierLon,
  step: _step,
}: DeliveryMapProps) {
  void _step;
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep real Leaflet instances in refs so we don't re-create on every render
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const courierRef = useRef<import("leaflet").Marker | null>(null);
  const routeRef = useRef<import("leaflet").Polyline | null>(null);

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Clear stale Leaflet id left on the DOM node by React StrictMode's double-invoke
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (containerRef.current as any)._leaflet_id;

    // Leaflet must run client-side only — dynamic import to avoid SSR errors
    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return; // guard for async gap
      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const midLat = (restaurantLat + customerLat) / 2;
      const midLon = (restaurantLon + customerLon) / 2;

      const map = L.map(containerRef.current!, {
        center: [midLat, midLon],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // ── Restaurant pin ───────────────────────────────────────────────────
      L.marker([restaurantLat, restaurantLon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:#c8864a;border:2px solid white;
            display:flex;align-items:center;justify-content:center;
            font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.25);
          ">🏪</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        }),
      }).addTo(map);

      // ── Customer (destination) pin ───────────────────────────────────────
      L.marker([customerLat, customerLon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center;">
            <div style="
              width:36px;height:36px;border-radius:50%;
              background:#2f7f5b;border:2px solid white;
              display:flex;align-items:center;justify-content:center;
              font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.25);
            ">🏠</div>
            <div style="width:2px;height:10px;background:#2f7f5b;"></div>
          </div>`,
          iconSize: [36, 46],
          iconAnchor: [18, 46],
        }),
      }).addTo(map);

      // ── Route polyline ───────────────────────────────────────────────────
      routeRef.current = L.polyline(
        [[restaurantLat, restaurantLon], [customerLat, customerLon]],
        { color: "#c8864a", weight: 3, dashArray: "8,6", opacity: 0.9 }
      ).addTo(map);

      // ── Courier marker (animated car) ────────────────────────────────────
      courierRef.current = L.marker([courierLat, courierLon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            font-size:26px;
            filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));
            transition:all 0.8s ease;
          " class="courier-car-icon">🚗</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        zIndexOffset: 1000,
      }).addTo(map);

      // Fit map to show all 3 points
      const bounds = L.latLngBounds([
        [restaurantLat, restaurantLon],
        [customerLat, customerLon],
        [courierLat, courierLon],
      ]);
      map.fitBounds(bounds, { padding: [28, 28] });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        courierRef.current = null;
        routeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update courier position on every change ──────────────────────────────
  useEffect(() => {
    if (!courierRef.current || !mapRef.current) return;
    courierRef.current.setLatLng([courierLat, courierLon]);
    // Pan map to keep courier visible
    mapRef.current.panTo([courierLat, courierLon], { animate: true, duration: 0.8 });
  }, [courierLat, courierLon]);

  // ── Update route: draw "completed" segment ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !routeRef.current) return;
    import("leaflet").then((L) => {
      // Draw travelled portion in solid accent color
      routeRef.current!.setStyle({ color: "#c8864a", weight: 3, dashArray: "8,6" });
      // Add solid "travelled" overlay
      L.polyline(
        [[restaurantLat, restaurantLon], [courierLat, courierLon]],
        { color: "#c8864a", weight: 4, opacity: 1 }
      ).addTo(mapRef.current!);
    });
    // Only redraw on significant position changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(courierLat * 1000), Math.round(courierLon * 1000)]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
