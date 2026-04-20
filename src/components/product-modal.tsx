"use client";

import { useRef } from "react";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import type { CatalogProduct } from "@/lib/types";
import type { AppLocale } from "@/lib/i18n";
import { CloseIcon, QuantityControl, makeSheetDragHandlers } from "./mini-app-shell";

interface Props {
    product: CatalogProduct;
    qty: number;
    isCartBusy: boolean;
    locale: AppLocale;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    onClose: () => void;
    onAdd: () => void;
    onIncrement: () => void;
    onDecrement: () => void;
    onGoToCart: () => void;
}

export default function ProductModal({
    product,
    qty,
    isCartBusy,
    locale,
    t,
    onClose,
    onAdd,
    onIncrement,
    onDecrement,
    onGoToCart,
}: Props) {
    const prodSheetRef = useRef<HTMLDivElement>(null);
    const prodDragStart = useRef(0);
    const prodDragCurrent = useRef(0);
    const prodDragTime = useRef(0);

    const prodDragHandlers = makeSheetDragHandlers(
        prodSheetRef,
        prodDragStart,
        prodDragCurrent,
        prodDragTime,
        onClose,
    );

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="absolute inset-0 bg-black/40 overlay-in" onClick={onClose} />
            <div ref={prodSheetRef} className="relative z-10 w-full max-w-[430px] mx-auto rounded-t-[28px] bg-[var(--app-bg)] overflow-hidden max-h-[85vh] flex flex-col sheet-up">
                {/* Drag handle */}
                <div className="flex justify-center items-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                    style={{ paddingTop: 14, paddingBottom: 14 }} {...prodDragHandlers}>
                    <div className="h-1.5 w-12 rounded-full bg-white/50" />
                </div>

                {/* Image */}
                <div className="relative aspect-[4/3] bg-[var(--app-muted)] shrink-0">
                    {product.imageUrl ? (
                        <Image src={product.imageUrl} alt={product.title} fill sizes="430px" className="object-cover" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-5xl">🥐</div>
                    )}
                    <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm">
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-5 flex-1">
                    <p className="text-xs text-[var(--app-text-soft)] mb-1">{product.categoryTitle}</p>
                    <h2 className="text-xl font-bold text-[var(--app-text)]">{product.title}</h2>
                    {product.description && <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-soft)]">{product.description}</p>}
                    {product.weight > 0 && <p className="mt-2 text-xs text-[var(--app-text-soft)]">{t.common.weight}: {product.weight} g</p>}
                </div>

                {/* CTA */}
                <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-bg)]">
                    {qty === 0 ? (
                        <button type="button" disabled={isCartBusy} onClick={onAdd} className="w-full rounded-[18px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition active:scale-95 disabled:opacity-50">
                            {t.product.addToCart} · {formatPrice(product.price, product.currency, locale)}
                        </button>
                    ) : (
                        <div className="flex items-center justify-between">
                            <QuantityControl quantity={qty} onDecrement={onDecrement} onIncrement={onIncrement} busy={isCartBusy} />
                            <button type="button" onClick={onGoToCart} className="rounded-[18px] bg-[var(--app-accent)] px-5 py-3 text-sm font-bold text-white">{t.product.goToCart} →</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}