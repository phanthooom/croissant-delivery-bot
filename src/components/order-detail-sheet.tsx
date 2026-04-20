"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { formatPrice } from "@/lib/format";
import { formatEtaText, translatePaymentMethod, type AppLocale } from "@/lib/i18n";
import type { OrderReceipt } from "@/lib/types";
import { statusToStep, makeSheetDragHandlers } from "./mini-app-shell";

// Leaflet/Yandex must never run on the server — load it only on client
const DeliveryMap = dynamic(() => import("./delivery-map"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-[var(--app-muted)] rounded-2xl">
            <span className="text-2xl animate-pulse">🗺️</span>
        </div>
    ),
});

const RESTAURANT = { lat: 41.2995, lon: 69.2401 };

interface Props {
    order: OrderReceipt;
    locale: AppLocale;
    intlLocale: string | string[];
    liveStatus: Record<string, string>;
    customerCoords: Record<string, { lat: number; lon: number }>;
    courierOffset: number;
    yandexMapsApiKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    onClose: () => void;
}

export default function OrderDetailSheet({
    order,
    locale,
    intlLocale,
    liveStatus,
    customerCoords,
    courierOffset,
    yandexMapsApiKey,
    t,
    onClose,
}: Props) {
    const paymentLabel = translatePaymentMethod(locale, order.paymentMethod);
    const effectiveStatus = liveStatus[order.orderId] ?? order.status ?? "pending";
    const step = statusToStep(effectiveStatus);
    const eta = formatEtaText(locale, order.createdAt, step);

    const statusColors = [
        "bg-amber-100 text-amber-700",
        "bg-blue-100 text-blue-700",
        "bg-[var(--app-accent-soft)] text-[var(--app-accent-strong)]",
        "bg-emerald-100 text-emerald-700",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusLabels = t.delivery.steps.map((deliveryStep: any) => deliveryStep.label);

    const sheetRef = useRef<HTMLDivElement>(null);
    const sheetDragStartY = useRef(0);
    const sheetDragCurrentY = useRef(0);
    const sheetDragTime = useRef(0);

    const dragHandlers = makeSheetDragHandlers(
        sheetRef,
        sheetDragStartY,
        sheetDragCurrentY,
        sheetDragTime,
        onClose,
    );

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="absolute inset-0 bg-black/40 overlay-in" onClick={onClose} />
            <div ref={sheetRef} className="relative z-10 w-full max-w-[430px] mx-auto rounded-t-[28px] bg-[var(--app-bg)] flex flex-col sheet-up" style={{ maxHeight: "92vh" }}>

                {/* Drag handle */}
                <div className="flex justify-center items-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                    style={{ paddingTop: 14, paddingBottom: 14 }}
                    {...dragHandlers}>
                    <div className="h-1.5 w-12 rounded-full bg-[var(--app-border)]" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0">
                    <div>
                        <p className="font-bold text-lg text-[var(--app-text)]">#{order.orderId.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-[var(--app-text-soft)] mt-0.5">
                            {new Intl.DateTimeFormat(intlLocale, {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                            }).format(new Date(order.createdAt))}
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusColors[step]}`}>
                        {statusLabels[step]}
                    </span>
                </div>

                {/* ── Status stepper ───────────────────────────────────────── */}
                <div className="px-5 pb-4 shrink-0">
                    <div className="relative flex justify-between items-start">
                        {/* Progress track */}
                        <div className="absolute top-4 left-4 right-4 h-0.5 bg-[var(--app-border)]">
                            <div className="h-full bg-[var(--app-accent)] transition-all duration-700 ease-out"
                                style={{ width: `${(step / 3) * 100}%` }} />
                        </div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {t.delivery.steps.map((s: any, i: number) => (
                            <div key={i} className="flex flex-col items-center gap-1.5 relative z-10 w-[25%]">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${i < step ? "bg-[var(--app-accent)] shadow-sm" :
                                    i === step ? "bg-[var(--app-accent)] shadow-md ring-4 ring-[var(--app-accent-soft)]" :
                                        "bg-[var(--app-muted)] border border-[var(--app-border)]"
                                    }`}>
                                    {i < step ? "✓" : s.icon}
                                </div>
                                <p className={`text-[10px] font-medium text-center leading-tight ${i === step ? "text-[var(--app-accent)]" : i < step ? "text-[var(--app-text)]" : "text-[var(--app-text-soft)]"
                                    }`}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ETA pill */}
                    {step < 3 && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="text-[var(--app-accent)]">🕐</span>
                            <span className="text-sm font-semibold text-[var(--app-accent)]">{eta}</span>
                            <span className="text-xs text-[var(--app-text-soft)]">· {t.common.updatesEvery20Seconds}</span>
                        </div>
                    )}
                </div>

                {/* ── Delivery map (Leaflet — real map with moving courier) ─── */}
                {step >= 0 && step < 3 && (() => {
                    const coords = customerCoords[order.orderId];
                    const dest = coords ?? RESTAURANT; // fallback while geocoding
                    const progress = courierOffset;
                    const cLat = RESTAURANT.lat + (dest.lat - RESTAURANT.lat) * progress;
                    const cLon = RESTAURANT.lon + (dest.lon - RESTAURANT.lon) * progress;
                    return (
                        <div className="px-5 pb-4 shrink-0">
                            <div className="relative rounded-2xl overflow-hidden border border-[var(--app-border)]" style={{ height: 200 }}>
                                <DeliveryMap
                                    restaurantLat={RESTAURANT.lat}
                                    restaurantLon={RESTAURANT.lon}
                                    customerLat={dest.lat}
                                    customerLon={dest.lon}
                                    courierLat={cLat}
                                    courierLon={cLon}
                                    step={step}
                                    apiKey={yandexMapsApiKey}
                                />
                                {/* ETA chip overlay */}
                                <div className="absolute bottom-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md pointer-events-none">
                                    <p className="text-xs font-bold text-[var(--app-text)] leading-none">{eta}</p>
                                    <p className="text-[10px] text-[var(--app-text-soft)] mt-0.5">{t.common.toYou}</p>
                                </div>
                                {/* Loading overlay while geocoding */}
                                {!coords && (
                                    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-[var(--app-muted)]/60 backdrop-blur-[2px]">
                                        <span className="text-sm text-[var(--app-text-soft)] animate-pulse">{t.common.routeLoading}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* ── Scrollable detail ────────────────────────────────────── */}
                <div className="overflow-y-auto px-5 space-y-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}>

                    {/* Items */}
                    <div className="store-panel rounded-[20px] overflow-hidden">
                        <p className="px-4 pt-4 pb-2 text-xs font-semibold text-[var(--app-text-soft)] uppercase tracking-wide">{t.orders.orderContents}</p>
                        <div className="divide-y divide-[var(--app-border)]">
                            {order.lines.map((line) => (
                                <div key={line.productId} className="flex items-center gap-3 px-4 py-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--app-muted)] text-base">🥐</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-[var(--app-text)] leading-tight">{line.title}</p>
                                        <p className="text-xs text-[var(--app-text-soft)] mt-0.5">{formatPrice(line.unitPrice, order.currency, locale)} × {line.quantity}</p>
                                    </div>
                                    <p className="text-sm font-bold text-[var(--app-text)] shrink-0">{formatPrice(line.lineTotal, order.currency, locale)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--app-border)] bg-[var(--app-muted)]">
                            <span className="font-semibold text-[var(--app-text)]">{t.common.total}</span>
                            <span className="font-bold text-lg text-[var(--app-accent)]">{formatPrice(order.total, order.currency, locale)}</span>
                        </div>
                    </div>

                    {/* Delivery info */}
                    <div className="store-panel rounded-[20px] divide-y divide-[var(--app-border)]">
                        <div className="flex justify-between items-start gap-3 px-4 py-3">
                            <span className="text-sm text-[var(--app-text-soft)] shrink-0">{t.common.address}</span>
                            <span className="text-sm font-medium text-[var(--app-text)] text-right">{order.address}</span>
                        </div>
                        <div className="flex justify-between items-center gap-3 px-4 py-3">
                            <span className="text-sm text-[var(--app-text-soft)]">{t.common.time}</span>
                            <span className="text-sm font-medium text-[var(--app-text)]">{order.deliveryTime || t.delivery.asap}</span>
                        </div>
                        <div className="flex justify-between items-center gap-3 px-4 py-3">
                            <span className="text-sm text-[var(--app-text-soft)]">{t.common.payment}</span>
                            <span className="text-sm font-medium text-[var(--app-text)]">{paymentLabel}</span>
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="store-panel rounded-[20px] divide-y divide-[var(--app-border)]">
                        <div className="flex justify-between items-center gap-3 px-4 py-3">
                            <span className="text-sm text-[var(--app-text-soft)]">{t.common.name}</span>
                            <span className="text-sm font-medium text-[var(--app-text)]">{order.customerName}</span>
                        </div>
                        <div className="flex justify-between items-center gap-3 px-4 py-3">
                            <span className="text-sm text-[var(--app-text-soft)]">{t.common.phone}</span>
                            <a href={`tel:${order.phone}`} className="text-sm font-medium text-[var(--app-accent)]">{order.phone}</a>
                        </div>
                    </div>

                    {order.comment && (
                        <div className="store-panel rounded-[20px] px-4 py-3">
                            <p className="text-xs text-[var(--app-text-soft)] mb-1">{t.common.comment}</p>
                            <p className="text-sm text-[var(--app-text)]">{order.comment}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}