"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/format";
import type { CatalogProduct } from "@/lib/types";
import type { AppLocale } from "@/lib/i18n";
import { SearchIcon, CloseIcon, QuantityControl } from "./mini-app-shell";

interface Props {
    query: string;
    setQuery: (q: string) => void;
    deferredQuery: string;
    searchResults: CatalogProduct[];
    locale: AppLocale;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    topPad: number;
    isCartBusy: boolean;
    getQuantity: (id: string) => number;
    setProductQuantity: (id: string, qty: number) => void;
    onClose: () => void;
    onSelectProduct: (p: CatalogProduct) => void;
}

export default function SearchOverlay({
    query,
    setQuery,
    deferredQuery,
    searchResults,
    locale,
    t,
    topPad,
    isCartBusy,
    getQuantity,
    setProductQuantity,
    onClose,
    onSelectProduct,
}: Props) {
    return (
        <div className="fixed inset-0 z-50 bg-[var(--app-bg)] flex flex-col fade-in">
            {/* Search header */}
            <div className="flex items-center gap-3 px-4 pb-3 border-b border-[var(--app-border)]" style={{ paddingTop: `${topPad + 10}px` }}>
                <div className="flex flex-1 items-center gap-3 rounded-[16px] bg-[var(--app-muted)] px-4 py-2.5">
                    <span className="text-[var(--app-text-soft)]"><SearchIcon /></span>
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t.search.placeholder}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-text-soft)]"
                    />
                    {query && (
                        <button type="button" onClick={() => setQuery("")} className="text-[var(--app-text-soft)]">
                            <CloseIcon />
                        </button>
                    )}
                </div>
                <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--app-text)]">
                    {t.common.cancel}
                </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
                {!deferredQuery ? (
                    <div className="py-10 text-center text-[var(--app-text-soft)]">
                        <p className="text-3xl mb-3">🔍</p>
                        <p className="text-sm">{t.search.emptyPrompt}</p>
                    </div>
                ) : searchResults.length === 0 ? (
                    <div className="py-10 text-center text-[var(--app-text-soft)]">
                        <p className="text-3xl mb-3">😔</p>
                        <p className="text-sm">{t.search.noResults(deferredQuery)}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {searchResults.map((product) => {
                            const qty = getQuantity(product.id);
                            return (
                                <div key={product.id} className="flex items-center gap-3 rounded-[18px] bg-[var(--app-surface)] border border-[var(--app-border)] p-3" onClick={() => onSelectProduct(product)}>
                                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[var(--app-muted)]">
                                        {product.imageUrl && <Image src={product.imageUrl} alt={product.title} fill sizes="48px" className="object-cover" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[var(--app-text)]">{product.title}</p>
                                        <p className="text-xs text-[var(--app-text-soft)]">{product.categoryTitle}</p>
                                    </div>
                                    <div className="shrink-0 text-right" onClick={(e) => e.stopPropagation()}>
                                        <p className="text-sm font-bold text-[var(--app-text)]">{formatPrice(product.price, product.currency, locale)}</p>
                                        {qty === 0 ? (
                                            <button type="button" onClick={() => void setProductQuantity(product.id, 1)} className="mt-1 rounded-full bg-[var(--app-accent)] px-3 py-1 text-xs font-semibold text-white">
                                                {t.search.addButton}
                                            </button>
                                        ) : (
                                            <QuantityControl quantity={qty} onDecrement={() => void setProductQuantity(product.id, qty - 1)} onIncrement={() => void setProductQuantity(product.id, qty + 1)} busy={isCartBusy} size="sm" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}