"use client";

import { useRef, useState } from "react";
import type { AppLocale } from "@/lib/i18n";
import { CloseIcon, LocationIcon, makeSheetDragHandlers } from "./mini-app-shell";

interface Props {
    locale: AppLocale;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    locationCoords: { lat: number; lon: number } | null;
    setLocationCoords: (c: { lat: number; lon: number } | null) => void;
    onSave: (address: string) => void;
    onClose: () => void;
}

export default function LocationModal({
    locale,
    t,
    locationCoords,
    setLocationCoords,
    onSave,
    onClose,
}: Props) {
    const [draft, setDraft] = useState("");
    const [locating, setLocating] = useState(false);
    const [locError, setLocError] = useState("");

    const locSheetRef = useRef<HTMLDivElement>(null);
    const locDragStart = useRef(0);
    const locDragCurrent = useRef(0);
    const locDragTime = useRef(0);

    async function reverseGeocode(lat: number, lon: number) {
        setLocationCoords({ lat, lon });
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=${locale}`,
                { headers: { "User-Agent": "CroissantMiniApp/1.0" } },
            );
            const data = (await res.json()) as {
                display_name?: string;
                address?: {
                    road?: string; pedestrian?: string; house_number?: string;
                    suburb?: string; neighbourhood?: string;
                    city?: string; town?: string; village?: string;
                };
            };
            const a = data.address ?? {};
            const parts = [
                a.road ?? a.pedestrian,
                a.house_number,
                a.suburb ?? a.neighbourhood,
                a.city ?? a.town ?? a.village,
            ].filter(Boolean);
            setDraft(parts.length ? parts.join(", ") : (data.display_name ?? ""));
        } catch {
            setLocError(t.location.reverseGeocodeFailed);
        }
    }

    async function detectLocation() {
        setLocating(true);
        setLocError("");
        if (!navigator.geolocation) {
            setLocError(t.location.geolocationUnsupported);
            setLocating(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                setLocating(false);
            },
            () => {
                setLocError(t.location.geolocationDenied);
                setLocating(false);
            },
            { timeout: 10000, enableHighAccuracy: true },
        );
    }

    function save() {
        if (!draft.trim()) return;
        onSave(draft.trim());
    }

    const locDragHandlers = makeSheetDragHandlers(
        locSheetRef,
        locDragStart,
        locDragCurrent,
        locDragTime,
        onClose,
    );

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="absolute inset-0 bg-black/40 overlay-in" onClick={onClose} />
            <div ref={locSheetRef} className="relative z-10 w-full max-w-[430px] mx-auto rounded-t-[28px] bg-[var(--app-bg)] sheet-up" style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 20px)` }}>
                {/* Drag handle */}
                <div className="flex justify-center items-center cursor-grab active:cursor-grabbing touch-none select-none" style={{ paddingTop: 14, paddingBottom: 14 }} {...locDragHandlers}>
                    <div className="h-1.5 w-12 rounded-full bg-[var(--app-border)]" />
                </div>
                <div className="px-5 pb-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold text-[var(--app-text)]">{t.location.title}</h2>
                        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-muted)] text-[var(--app-text-soft)]">
                            <CloseIcon />
                        </button>
                    </div>

                    {/* GPS button */}
                    <button type="button" disabled={locating} onClick={() => void detectLocation()} className="w-full flex items-center gap-3 rounded-2xl bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/30 px-4 py-3.5 mb-4 transition-all active:scale-95 disabled:opacity-60">
                        <span className="text-[var(--app-accent)]"><LocationIcon /></span>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-[var(--app-accent)]">{locating ? t.location.locating : t.location.detectLocation}</p>
                            <p className="text-xs text-[var(--app-text-soft)] mt-0.5">{t.location.gpsHint}</p>
                        </div>
                        {locating && (
                            <svg className="ml-auto h-4 w-4 animate-spin text-[var(--app-accent)]" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                            </svg>
                        )}
                    </button>

                    {locError && <p className="text-xs text-rose-500 mb-3 px-1">{locError}</p>}

                    {/* Map preview */}
                    {locationCoords && (
                        <div className="mb-4 rounded-2xl overflow-hidden border border-[var(--app-border)] fade-in">
                            <iframe
                                title={t.common.mapTitle}
                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationCoords.lon - 0.006},${locationCoords.lat - 0.004},${locationCoords.lon + 0.006},${locationCoords.lat + 0.004}&layer=mapnik&marker=${locationCoords.lat},${locationCoords.lon}`}
                                style={{ width: "100%", height: "180px", border: 0, display: "block" }}
                                loading="lazy"
                            />
                        </div>
                    )}

                    {/* Manual input */}
                    <p className="text-xs text-[var(--app-text-soft)] mb-2 px-1">{t.common.manually}</p>
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={t.location.addressPlaceholder}
                        rows={3}
                        className="store-input resize-none mb-4"
                        autoFocus={!draft}
                    />

                    <button type="button" disabled={!draft.trim()} onClick={save} className="w-full rounded-[16px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition-all active:scale-95 disabled:opacity-40">
                        {t.common.saveAddress}
                    </button>
                </div>
            </div>
        </div>
    );
}