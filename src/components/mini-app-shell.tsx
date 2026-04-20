"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatPrice } from "@/lib/format";
import {
  APP_LOCALES,
  formatCartCount,
  formatEtaText,
  getIntlLocale,
  getTranslations,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  pickLocalizedText,
  translatePaymentMethod,
  type AppLocale,
} from "@/lib/i18n";

// Leaflet must never run on the server — load it only on client
const DeliveryMap = dynamic(() => import("./delivery-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--app-muted)] rounded-2xl">
      <span className="text-2xl animate-pulse">🗺️</span>
    </div>
  ),
});

const YandexMapPicker = dynamic(() => import("./yandex-map-picker"), {
  ssr: false,
});
import type {
  BackendCart,
  BackendCartItem,
  CatalogProduct,
  CatalogSnapshot,
  OrderFormInput,
  OrderReceipt,
  PublicAppConfig,
  ServerCapabilities,
  TelegramMiniAppUser,
  TelegramSessionInfo,
} from "@/lib/types";

// ─── types ───────────────────────────────────────────────────────────────────

type View = "catalog" | "cart" | "orders" | "profile";

interface MiniAppShellProps {
  initialCatalog: CatalogSnapshot;
  app: PublicAppConfig;
  capabilities: ServerCapabilities;
  initialLocale: AppLocale;
}

interface CartProductLine {
  itemId?: string;
  product: CatalogProduct;
  quantity: number;
  subtotal: number;
}

interface OrderState {
  type: "idle" | "success" | "error";
  message: string;
  orderId?: string;
  receipt?: OrderReceipt;
}

interface CheckoutFormState {
  customerName: string;
  phone: string;
  address: string;
  comment: string;
  paymentMethod: OrderFormInput["paymentMethod"];
  deliveryTime: string;
}

const STORAGE_KEY = "fooddd-mini-app-state";
const LOCALE_STORAGE_KEY = "fooddd-mini-app-locale";

// ─── helpers ─────────────────────────────────────────────────────────────────

function findProduct(catalog: CatalogSnapshot, productId: string) {
  for (const cat of catalog.categories) {
    const p = cat.products.find((p) => p.id === productId);
    if (p) return p;
  }
  return null;
}

function readUnsafeTelegramUser(): TelegramMiniAppUser | null {
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!u?.id || !u.first_name) return null;
  return {
    id: String(u.id),
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    languageCode: u.language_code,
    isPremium: u.is_premium,
    photoUrl: u.photo_url,
    allowsWriteToPm: u.allows_write_to_pm,
  };
}

function readStartParam() {
  const t = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (t) return t;
  const p = new URLSearchParams(window.location.search);
  return p.get("start") ?? p.get("tgWebAppStartParam");
}

function normalizeStoredCart(input: unknown) {
  if (!input || typeof input !== "object") return {} as Record<string, number>;
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const q = Math.trunc(Number(v));
    if (Number.isFinite(q) && q > 0) next[k] = Math.min(q, 20);
  }
  return next;
}

function toNumber(v: number | string | null | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildBackendCartProduct(
  item: BackendCartItem,
  catalog: CatalogSnapshot,
  locale: AppLocale,
): CatalogProduct {
  const existing = findProduct(catalog, item.product_id);
  if (existing) return existing;

  const catTitle =
    pickLocalizedText(
      locale,
      {
        ru: item.product.category?.name_ru,
        uz: item.product.category?.name_uz,
        en: item.product.category?.name_en,
      },
      [item.product.category?.name, "Category"],
    ) || "Category";

  return {
    id: item.product.id,
    slug: item.product.id,
    title:
      pickLocalizedText(
        locale,
        {
          ru: item.product.name_ru,
          uz: item.product.name_uz,
          en: item.product.name_en,
        },
        [item.product.name, "Product"],
      ) || "Product",
    description:
      pickLocalizedText(
        locale,
        {
          ru: item.product.description_ru,
          uz: item.product.description_uz,
          en: item.product.description_en,
        },
        [item.product.description],
      ) || "",
    price: toNumber(item.product.price),
    currency: "UZS",
    imageUrl: item.product.image_url,
    categoryId: item.product.category_id ?? "uncategorized",
    categoryTitle: catTitle,
    rating: 0,
    weight: 0,
    hasModifier: false,
    isActive: item.product.is_active,
  };
}

function initialSession(cap: ServerCapabilities): TelegramSessionInfo {
  return {
    verified: false,
    initDataPresent: false,
    startParam: null,
    user: null,
    backendEnabled: cap.hasBackendApi,
    backendAuthenticated: false,
    mode: "preview",
    profile: null,
  };
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

// ─── icons ────────────────────────────────────────────────────────────────────

function HomeIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 3 3 10v10h6v-6h6v6h6V10l-9-7Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3 10v10h6v-6h6v6h6V10l-9-7Z" />
    </svg>
  );
}

function CartIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" fill="none" stroke="white" strokeWidth="1.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ReceiptIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21V5a2 2 0 0 1 2-2Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21V3Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function UserIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function QuantityControl({
  quantity,
  onDecrement,
  onIncrement,
  busy,
  size = "md",
}: {
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
  busy?: boolean;
  size?: "sm" | "md";
}) {
  const btnCls = size === "sm"
    ? "flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-accent)] text-white disabled:opacity-40"
    : "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-accent)] text-white disabled:opacity-40";

  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={busy} onClick={onDecrement} className={btnCls}>
        <MinusIcon />
      </button>
      <span className="w-5 text-center text-sm font-bold text-[var(--app-text)]">{quantity}</span>
      <button type="button" disabled={busy} onClick={onIncrement} className={btnCls}>
        <PlusIcon />
      </button>
    </div>
  );
}

// ─── delivery tracking helpers ───────────────────────────────────────────────

function statusToStep(status: string | undefined): 0 | 1 | 2 | 3 {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (["delivered", "completed", "done", "closed", "закрыт", "выполнен"].some(x => s.includes(x))) return 3;
  if (["delivering", "in_transit", "on_way", "delivery"].some(x => s.includes(x))) return 2;
  if (["ready", "picked", "collected", "courier_assigned", "taken"].some(x => s.includes(x))) return 1;
  return 0;
}

// ─── BrandLogo (pure — outside component to avoid re-creation on every render) ──

const BrandLogo = memo(function BrandLogo({ size, light }: { size: number; light?: boolean }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full overflow-hidden shrink-0 ${light ? "ring-2 ring-white/40 shadow-lg" : "ring-1 ring-[var(--app-border)] shadow-sm"}`}
    >
      <Image src="/logo.png" alt="Croissant" fill sizes={`${size}px`} className="object-cover" priority />
    </div>
  );
});

// ─── shared bottom-sheet drag helper ─────────────────────────────────────────
// Attach the returned props to the drag-handle div; pass `sheetEl` ref to the
// sheet container. Tap (dy < 10) or drag > 90px or fast flick → dismiss.
function makeSheetDragHandlers(
  sheetEl: { current: HTMLDivElement | null },
  startRef: { current: number },
  currentRef: { current: number },
  timeRef: { current: number },
  onClose: () => void,
) {
  function onPointerDown(e: React.PointerEvent) {
    startRef.current = e.clientY;
    currentRef.current = 0;
    timeRef.current = Date.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const dy = Math.max(0, e.clientY - startRef.current);
    currentRef.current = dy;
    if (sheetEl.current) {
      sheetEl.current.style.transition = "none";
      sheetEl.current.style.transform = `translateY(${dy}px)`;
    }
  }
  function dismiss() {
    if (!sheetEl.current) return;
    sheetEl.current.style.transition = "transform 300ms cubic-bezier(0.32,0.72,0,1)";
    sheetEl.current.style.transform = "translateY(110%)";
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    setTimeout(onClose, 300);
  }
  function snap() {
    if (!sheetEl.current) return;
    sheetEl.current.style.transition = "transform 320ms cubic-bezier(0.32,0.72,0,1)";
    sheetEl.current.style.transform = "translateY(0)";
  }
  function onPointerUp() {
    const dy = currentRef.current;
    const elapsed = Math.max(1, Date.now() - timeRef.current);
    const velocity = dy / elapsed; // px/ms
    currentRef.current = 0;
    // fast flick down OR dragged more than 80px → close; otherwise snap back
    if (velocity > 0.4 || dy > 80) dismiss();
    else snap();
  }
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}

// ─── main component ───────────────────────────────────────────────────────────

export default function MiniAppShell({
  initialCatalog,
  app,
  capabilities,
  initialLocale,
}: MiniAppShellProps) {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [catalog, setCatalog] = useState<CatalogSnapshot>(initialCatalog);
  const t = getTranslations(locale);
  const intlLocale = getIntlLocale(locale);

  const [view, setView] = useState<View>("catalog");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialCatalog.categories[0]?.id ?? "",
  );
  const [localCart, setLocalCart] = useState<Record<string, number>>({});
  const [remoteCart, setRemoteCart] = useState<BackendCart | null>(null);
  const [session, setSession] = useState<TelegramSessionInfo>(initialSession(capabilities));
  const [inTelegram, setInTelegram] = useState(false);
  const [safeTop, setSafeTop] = useState(0);
  const [form, setForm] = useState<CheckoutFormState>({
    customerName: "",
    phone: "",
    address: "",
    comment: "",
    paymentMethod: "cash",
    deliveryTime: t.delivery.asap,
  });
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartBusy, setIsCartBusy] = useState(false);
  const [orderState, setOrderState] = useState<OrderState>({ type: "idle", message: "" });
  const [pastOrders, setPastOrders] = useState<OrderReceipt[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderReceipt | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const openLocation = useCallback(() => {
    setMapPickerOpen(true);
  }, []);
  const [locationDraft, setLocationDraft] = useState("");
  const [locationLocating, setLocationLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const pillsContainerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragStartY = useRef(0);
  const sheetDragCurrentY = useRef(0);
  const sheetDragTime = useRef(0);
  const locSheetRef = useRef<HTMLDivElement>(null);
  const locDragStart = useRef(0);
  const locDragCurrent = useRef(0);
  const locDragTime = useRef(0);
  const prodSheetRef = useRef<HTMLDivElement>(null);
  const prodDragStart = useRef(0);
  const prodDragCurrent = useRef(0);
  const prodDragTime = useRef(0);
  // debounce timers & pending quantities for backend cart optimistic updates
  const cartDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [optimisticQty, setOptimisticQty] = useState<Record<string, number>>({});
  // delivery tracking
  const [courierOffset, setCourierOffset] = useState(0.05);
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});
  const courierIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // geocoded customer coordinates per orderId
  const [customerCoords, setCustomerCoords] = useState<Record<string, { lat: number; lon: number }>>({});
  // Restaurant fixed location (Tashkent center — replace with your actual restaurant coords)
  const RESTAURANT = { lat: 41.2995, lon: 69.2401 };

  const allProducts = useMemo(
    () => catalog.categories.flatMap((c) => c.products),
    [catalog],
  );

  // In expanded (non-fullscreen) Telegram mode, the "X Close" bar overlays ~56-68px of the WebView.
  // safeTop (from contentSafeAreaInset) fixes this in fullscreen. In expanded mode it's 0,
  // so we enforce a 72px minimum whenever we're inside Telegram.
  const topPad = inTelegram ? Math.max(safeTop, 72) : Math.max(safeTop, 0);

  useEffect(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch { }
  }, [locale]);

  useEffect(() => {
    const asapValues = new Set(
      APP_LOCALES.map((appLocale) => getTranslations(appLocale).delivery.asap),
    );
    setForm((current) =>
      asapValues.has(current.deliveryTime)
        ? { ...current, deliveryTime: t.delivery.asap }
        : current,
    );
  }, [locale, t.delivery.asap]);

  async function switchLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;

    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setLocale(nextLocale);

    try {
      const res = await fetch(`/api/catalog?locale=${encodeURIComponent(nextLocale)}`, {
        cache: "no-store",
      });
      const nextCatalog = (await res.json()) as CatalogSnapshot;
      startTransition(() => {
        setCatalog(nextCatalog);
        setSelectedCategoryId((current) =>
          nextCatalog.categories.some((category) => category.id === current)
            ? current
            : (nextCatalog.categories[0]?.id ?? ""),
        );
      });
    } catch {
      // Keep the current UI responsive even if localized catalog refresh fails.
    }
  }

  const syncPreferredLocale = useEffectEvent((nextLocale: AppLocale | null) => {
    if (nextLocale && nextLocale !== locale) {
      void switchLocale(nextLocale);
    }
  });

  // Backend cart only works when catalog products also come from the backend.
  // Website-parser product IDs don't exist in the backend DB → 400 on every add.
  const usingBackendCart =
    capabilities.hasBackendApi &&
    session.backendAuthenticated &&
    catalog.sourceKind === "backend-api";

  const remoteItemByProductId = useMemo(
    () => new Map((remoteCart?.items ?? []).map((item) => [item.product_id, item])),
    [remoteCart],
  );

  const cartLines = useMemo<CartProductLine[]>(() => {
    if (usingBackendCart) {
      return (remoteCart?.items ?? []).map((item) => ({
        itemId: item.id,
        product: buildBackendCartProduct(item, catalog, locale),
        quantity: optimisticQty[item.product_id] ?? item.quantity,
        subtotal: (optimisticQty[item.product_id] ?? item.quantity) * toNumber(item.product.price),
      }));
    }
    return Object.entries(localCart)
      .map(([id, qty]) => {
        const p = findProduct(catalog, id);
        if (!p || qty <= 0) return null;
        return { product: p, quantity: qty, subtotal: p.price * qty };
      })
      .filter((l): l is CartProductLine => Boolean(l));
  }, [usingBackendCart, remoteCart, localCart, catalog, optimisticQty, locale]);

  const cartCount = useMemo(
    () => usingBackendCart
      ? cartLines.reduce((s, l) => s + l.quantity, 0)
      : cartLines.reduce((s, l) => s + l.quantity, 0),
    [cartLines, usingBackendCart],
  );
  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + l.subtotal, 0),
    [cartLines],
  );

  // ── persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    let nextCart: Record<string, number> = {};
    let nextForm: Partial<CheckoutFormState> = {};
    let nextLocale: AppLocale | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { cart?: unknown; form?: Partial<CheckoutFormState> };
        nextCart = normalizeStoredCart(parsed.cart);
        nextForm = parsed.form ?? {};
      }
      const rawLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (rawLocale) {
        nextLocale = normalizeLocale(rawLocale);
      }
    } catch { }
    queueMicrotask(() => {
      if (Object.keys(nextCart).length > 0) setLocalCart(nextCart);
      if (Object.keys(nextForm).length > 0) setForm((c) => ({ ...c, ...nextForm }));
      setHasHydrated(true);
      syncPreferredLocale(nextLocale);
    });
  }, []);

  useEffect(() => {
    const telegramLocaleCode = readUnsafeTelegramUser()?.languageCode;
    if (!telegramLocaleCode) return;
    try {
      if (window.localStorage.getItem(LOCALE_STORAGE_KEY)) return;
    } catch { }

    const telegramLocale = normalizeLocale(telegramLocaleCode);
    syncPreferredLocale(telegramLocale);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart: localCart, form }));
  }, [localCart, form, hasHydrated]);

  // ── telegram init ─────────────────────────────────────────────────────────

  const syncTheme = useEffectEvent(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    const t = wa.themeParams ?? {};
    const r = document.documentElement;
    const map: Array<[string, string | undefined]> = [
      ["--tg-bg-color", t.bg_color],
      ["--tg-secondary-bg-color", t.secondary_bg_color],
      ["--tg-text-color", t.text_color],
      ["--tg-hint-color", t.hint_color],
      ["--tg-link-color", t.link_color],
      ["--tg-button-color", t.button_color],
      ["--tg-button-text-color", t.button_text_color],
    ];
    for (const [k, v] of map) if (v) r.style.setProperty(k, v);
  });

  const bootstrapSession = useEffectEvent(async () => {
    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (!initData || !capabilities.canValidateTelegramSession) return;
    try {
      const res = await fetch("/api/telegram/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const payload = (await res.json()) as TelegramSessionInfo & { reason?: string };
      startTransition(() => {
        setSession(payload);
        if (payload.user?.firstName)
          setForm((c) => ({ ...c, customerName: c.customerName || payload.user?.firstName || "" }));
      });
      if (payload.backendAuthenticated) await refreshRemoteCart();
    } catch {
      startTransition(() => {
        setSession((c) => ({ ...c, user: c.user ?? readUnsafeTelegramUser() }));
      });
    }
  });

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) {
      const u = readUnsafeTelegramUser();
      setSession((c) => ({ ...c, startParam: readStartParam(), user: c.user ?? u }));
      if (u?.firstName) setForm((c) => ({ ...c, customerName: c.customerName || u.firstName }));
      return;
    }
    const twa = wa as unknown as {
      requestFullscreen?: () => void;
      isFullscreen?: boolean;
      safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
      contentSafeAreaInset?: { top?: number };
      onEvent?: (event: string, cb: () => void) => void;
      offEvent?: (event: string, cb: () => void) => void;
    };

    wa.ready?.();
    wa.expand?.();
    twa.requestFullscreen?.();
    (wa as unknown as { disableVerticalSwipes?: () => void }).disableVerticalSwipes?.();
    setInTelegram(true);

    const updateSafeArea = () => {
      const top = twa.contentSafeAreaInset?.top ?? twa.safeAreaInset?.top ?? 0;
      setSafeTop(top);
    };
    updateSafeArea();
    twa.onEvent?.("safeAreaChanged", updateSafeArea);
    twa.onEvent?.("fullscreenChanged", updateSafeArea);

    const u = readUnsafeTelegramUser();
    setSession((c) => ({
      ...c,
      initDataPresent: Boolean(wa.initData),
      startParam: readStartParam(),
      user: c.user ?? u,
    }));
    if (u?.firstName) setForm((c) => ({ ...c, customerName: c.customerName || u.firstName }));
    syncTheme();
    wa.onEvent?.("themeChanged", syncTheme);
    void bootstrapSession();
    return () => {
      wa.offEvent?.("themeChanged", syncTheme);
      twa.offEvent?.("safeAreaChanged", updateSafeArea);
      twa.offEvent?.("fullscreenChanged", updateSafeArea);
    };
  }, []);

  // ── cart helpers ──────────────────────────────────────────────────────────

  async function refreshRemoteCart() {
    if (!capabilities.hasBackendApi) return;
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; cart?: BackendCart };
      if (res.ok && data.ok && data.cart) startTransition(() => setRemoteCart(data.cart ?? null));
    } catch { }
  }

  function setProductQuantity(productId: string, next: number) {
    const current = getQuantity(productId);
    if (next > current) window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");

    if (usingBackendCart) {
      const qty = Math.max(0, Math.min(100, Math.trunc(next)));
      // Optimistic UI update — instant, no waiting for API
      setOptimisticQty((prev) => {
        if (qty === 0) { const rest = { ...prev }; delete rest[productId]; return rest; }
        return { ...prev, [productId]: qty };
      });
      // Debounce: flush to API after 350ms of inactivity per product
      const existing = cartDebounceTimers.current.get(productId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        cartDebounceTimers.current.delete(productId);
        void updateBackendQty(productId, qty);
      }, 350);
      cartDebounceTimers.current.set(productId, timer);
    } else {
      startTransition(() => {
        setLocalCart((c) => {
          const qty = Math.max(0, Math.min(20, Math.trunc(next)));
          if (qty === 0) { const n = { ...c }; delete n[productId]; return n; }
          return { ...c, [productId]: qty };
        });
        setOrderState({ type: "idle", message: "" });
      });
    }
  }

  async function updateBackendQty(productId: string, next: number) {
    const qty = Math.max(0, Math.min(100, Math.trunc(next)));
    const existing = remoteItemByProductId.get(productId);
    setIsCartBusy(true);
    try {
      const res = !existing && qty > 0
        ? await fetch("/api/cart/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, quantity: qty }) })
        : qty === 0 && existing
          ? await fetch(`/api/cart/items/${existing.id}`, { method: "DELETE" })
          : await fetch(`/api/cart/items/${existing?.id ?? ""}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: qty }) });
      const data = (await res.json()) as { ok: boolean; cart?: BackendCart };
      if (res.ok && data.ok && data.cart) {
        startTransition(() => {
          setRemoteCart(data.cart ?? null);
          // Clear optimistic for this product — server state is now authoritative
          setOptimisticQty((prev) => { const rest = { ...prev }; delete rest[productId]; return rest; });
        });
      }
    } finally {
      setIsCartBusy(false);
    }
  }

  async function clearCart() {
    if (usingBackendCart) {
      setIsCartBusy(true);
      try {
        const res = await fetch("/api/cart", { method: "DELETE" });
        const data = (await res.json()) as { ok: boolean; cart?: BackendCart };
        if (res.ok && data.ok) startTransition(() => setRemoteCart(data.cart ?? null));
      } finally {
        setIsCartBusy(false);
      }
    } else {
      startTransition(() => setLocalCart({}));
    }
  }

  async function handleCheckout() {
    if (cartCount === 0) return;
    if (!form.address.trim()) {
      openLocation();
      return;
    }
    const missing: string[] = [];
    if (!form.customerName.trim()) missing.push(t.validation.missingFieldLabels.customerName);
    if (!form.phone.trim()) missing.push(t.validation.missingFieldLabels.phone);
    if (missing.length > 0) {
      setOrderState({ type: "error", message: t.validation.requiredFields(missing) });
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      return;
    }
    setIsSubmitting(true);
    setOrderState({ type: "idle", message: "" });
    try {
      const payload: OrderFormInput = {
        customerName: form.customerName,
        phone: form.phone,
        address: form.address,
        comment: form.comment,
        paymentMethod: form.paymentMethod,
        deliveryMode: "delivery",
        deliveryTime: form.deliveryTime,
        startParam: session.startParam,
        initData: window.Telegram?.WebApp?.initData ?? "",
        locale,
        previewUser: session.user,
        items: usingBackendCart ? [] : cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        idempotencyKey: createIdempotencyKey(),
        useBackendOrder: usingBackendCart,
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as { ok: boolean; error?: string; receipt?: OrderReceipt };
      if (!res.ok || !result.ok || !result.receipt) {
        throw new Error(result.error || t.validation.createOrderFailed);
      }
      startTransition(() => {
        setOrderState({ type: "success", message: t.validation.accepted, receipt: result.receipt });
        if (result.receipt) {
          setPastOrders((prev) => [result.receipt!, ...prev]);
          // Persist GPS coords so the delivery map uses the exact point, not a re-geocoded guess
          if (locationCoords) {
            setCustomerCoords((prev) => ({
              ...prev,
              [result.receipt!.orderId]: locationCoords,
            }));
          }
        }
      });
      if (usingBackendCart) await refreshRemoteCart();
      else startTransition(() => setLocalCart({}));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      setView("orders");
    } catch (err) {
      startTransition(() => {
        setOrderState({ type: "error", message: err instanceof Error ? err.message : t.validation.error });
      });
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const getQuantity = useCallback((productId: string) => {
    if (usingBackendCart) {
      return optimisticQty[productId] ?? remoteItemByProductId.get(productId)?.quantity ?? 0;
    }
    return localCart[productId] ?? 0;
  }, [usingBackendCart, optimisticQty, remoteItemByProductId, localCart]);

  // ── courier animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (courierIntervalRef.current) { clearInterval(courierIntervalRef.current); courierIntervalRef.current = null; }
    if (!selectedOrder) return;
    const step = statusToStep(liveStatus[selectedOrder.orderId] ?? selectedOrder.status);
    const base = [0.05, 0.30, 0.55, 1.0][step] ?? 0.05;
    setCourierOffset(base);
    if (step === 2) {
      courierIntervalRef.current = setInterval(() => {
        setCourierOffset(prev => {
          const next = prev + 0.004;
          if (next >= 0.94) { clearInterval(courierIntervalRef.current!); courierIntervalRef.current = null; return 0.94; }
          return next;
        });
      }, 200);
    }
    return () => { if (courierIntervalRef.current) { clearInterval(courierIntervalRef.current); courierIntervalRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.orderId, liveStatus[selectedOrder?.orderId ?? ""]]);

  // ── order status polling ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedOrder) return;
    const step = statusToStep(liveStatus[selectedOrder.orderId] ?? selectedOrder.status);
    if (step >= 3) return;
    const orderId = selectedOrder.orderId;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (data.status) setLiveStatus(prev => ({ ...prev, [orderId]: data.status! }));
      } catch { }
    };
    const t = setInterval(poll, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.orderId]);

  // ── geocode customer address when order sheet opens ──────────────────────

  useEffect(() => {
    if (!selectedOrder) return;
    const id = selectedOrder.orderId;
    if (customerCoords[id]) return; // already geocoded
    const addr = selectedOrder.address;
    if (!addr?.trim()) return;
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`,
          { headers: { "User-Agent": "CroissantMiniApp/1.0" } },
        );
        const data = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (data[0]) {
          setCustomerCoords(prev => ({
            ...prev,
            [id]: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) },
          }));
        }
      } catch { }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.orderId]);

  // ── splash timer ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fade = setTimeout(() => setSplashFading(true), 1300);
    const hide = setTimeout(() => setShowSplash(false), 1800);
    return () => { clearTimeout(fade); clearTimeout(hide); };
  }, []);

  // ── active category on scroll ─────────────────────────────────────────────

  useEffect(() => {
    if (view !== "catalog") return;
    const headerH = stickyHeaderRef.current?.offsetHeight ?? 120;
    const sections = catalog.categories
      .map((cat) => document.getElementById(`cat-${cat.id}`))
      .filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setSelectedCategoryId(hit.target.id.replace("cat-", ""));
      },
      { rootMargin: `-${headerH + 8}px 0px -55% 0px`, threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [view, catalog.categories]);

  // ── scroll active pill into view ──────────────────────────────────────────

  useEffect(() => {
    const container = pillsContainerRef.current;
    if (!container) return;
    const pill = container.querySelector<HTMLElement>(`[data-catid="${selectedCategoryId}"]`);
    pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedCategoryId]);

  // ── search results ────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    return allProducts
      .filter((p) =>
        [p.title, p.description, p.categoryTitle, p.slug].join(" ").toLowerCase().includes(deferredQuery),
      )
      .slice(0, 40);
  }, [deferredQuery, allProducts]);

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  function SplashScreen() {
    return (
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--app-accent)] ${splashFading ? "splash-out" : ""}`}
      >
        <BrandLogo size={130} light />
        <p className="font-display text-2xl font-bold text-white tracking-[0.14em] mt-5">Croissant</p>
        <p className="text-white/60 text-xs tracking-[0.22em] uppercase mt-1.5">{t.splashSubtitle}</p>
      </div>
    );
  }

  function ProductCard({ product }: { product: CatalogProduct }) {
    const qty = getQuantity(product.id);
    return (
      <div
        className="bg-white rounded-2xl overflow-hidden border border-[var(--app-border)] cursor-pointer"
        onClick={() => setSelectedProduct(product)}
      >
        <div className="relative aspect-square bg-[var(--app-muted)]">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.title} fill sizes="(max-width: 430px) 45vw, 200px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🥐</div>
          )}
        </div>
        <div className="p-2.5">
          <p className="text-sm font-bold text-[var(--app-text)]">
            {formatPrice(product.price, product.currency, locale)}
          </p>
          <p className="mt-0.5 text-sm text-[var(--app-text)] leading-5 line-clamp-2 min-h-[40px]">
            {product.title}
          </p>
          {product.weight > 0 && (
            <p className="text-xs text-[var(--app-text-soft)] mt-0.5">{product.weight} g</p>
          )}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            {qty === 0 ? (
              <button
                type="button"
                disabled={isCartBusy}
                onClick={() => void setProductQuantity(product.id, 1)}
                className="w-full rounded-xl border border-[var(--app-border)] py-2 text-sm font-medium text-[var(--app-text)] transition-all active:scale-95 active:bg-[var(--app-muted)] disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <PlusIcon />
                {t.common.add}
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-[var(--app-accent)] px-2 py-1.5">
                <button type="button" disabled={isCartBusy} onClick={() => void setProductQuantity(product.id, qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-40">
                  <MinusIcon />
                </button>
                <span className="text-sm font-bold text-white">{qty}</span>
                <button type="button" disabled={isCartBusy} onClick={() => void setProductQuantity(product.id, qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-40">
                  <PlusIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function CatalogView() {
    return (
      <div className="fade-in">
        {/* Top bar */}
        <div ref={stickyHeaderRef} className="sticky top-0 z-20 bg-[var(--app-bg)] border-b border-[var(--app-border)]">
          <div
            className="grid items-center px-4 pb-3 gap-2"
            style={{ paddingTop: `${topPad + 14}px`, gridTemplateColumns: "1fr auto 1fr" }}
          >
            {/* Left — location */}
            <button type="button" onClick={() => openLocation()} className="flex items-center gap-1.5 min-w-0 transition-opacity active:opacity-60">
              <span className={form.address.trim() ? "text-[var(--app-accent)]" : "text-[var(--app-text-soft)]"}><LocationIcon /></span>
              <div className="text-left min-w-0">
                <p className="text-[11px] text-[var(--app-text-soft)]">{t.common.delivery}</p>
                <p className={`text-sm font-semibold leading-tight truncate max-w-[110px] ${form.address.trim() ? "text-[var(--app-text)]" : "text-[var(--app-accent)]"}`}>
                  {form.address.trim() || `${t.common.address} →`}
                </p>
              </div>
            </button>
            {/* Center — logo */}
            <div className="flex justify-center">
              <BrandLogo size={42} />
            </div>
            {/* Right — search */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-muted)] text-[var(--app-text-soft)] transition-transform active:scale-90"
              >
                <SearchIcon />
              </button>
            </div>
          </div>

          {/* Category pills */}
          <div ref={pillsContainerRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
            {catalog.categories.map((cat) => (
              <button
                key={cat.id}
                data-catid={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  const el = document.getElementById(`cat-${cat.id}`);
                  if (!el) return;
                  const headerH = stickyHeaderRef.current?.offsetHeight ?? 120;
                  const top = el.getBoundingClientRect().top + window.scrollY - headerH;
                  window.scrollTo({ top, behavior: "smooth" });
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-95 ${cat.id === selectedCategoryId
                  ? "bg-[var(--app-accent)] text-white"
                  : "bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text-soft)]"
                  }`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </div>

        {/* All categories with products */}
        {catalog.categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--app-text-soft)]">
            <p className="text-4xl mb-3">🛍️</p>
            <p className="font-medium">{t.common.loadingMenu}</p>
          </div>
        ) : (
          catalog.categories.map((cat) => (
            <div key={cat.id} id={`cat-${cat.id}`} className="px-4 pt-5 pb-2">
              <h2 className="text-base font-bold text-[var(--app-text)] mb-3">{cat.title}</h2>
              <div className="grid grid-cols-2 gap-3">
                {cat.products.map((product) => (
                  <div key={product.id}>{ProductCard({ product })}</div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="h-4" />
      </div>
    );
  }

  function CartView() {
    return (
      <div className="fade-in">
        <div className="px-4 pb-3 bg-[var(--app-bg)]" style={{ paddingTop: `${topPad + 16}px` }}>
          <h1 className="text-xl font-bold text-[var(--app-text)]">{t.cart.title}</h1>
          {cartCount > 0 && (
            <p className="text-sm text-[var(--app-text-soft)] mt-0.5">{formatCartCount(locale, cartCount)}</p>
          )}
        </div>

        <div className="px-4 pb-6 space-y-3">
          {cartLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-5xl mb-4">🛒</p>
              <p className="font-semibold text-[var(--app-text)] text-lg">{t.cart.emptyTitle}</p>
              <p className="text-sm text-[var(--app-text-soft)] mt-1">{t.cart.emptyDescription}</p>
              <button
                type="button"
                onClick={() => setView("catalog")}
                className="mt-5 rounded-[16px] bg-[var(--app-accent)] px-6 py-3 text-sm font-semibold text-white"
              >
                {t.common.backToCatalog}
              </button>
            </div>
          ) : (
            <>
              {/* Cart items */}
              <div className="store-panel rounded-[22px] p-3 space-y-2">
                {cartLines.map((line) => (
                  <div key={line.itemId ?? line.product.id} className="flex items-center gap-3 p-2">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-[var(--app-muted)]">
                      {line.product.imageUrl && (
                        <Image src={line.product.imageUrl} alt={line.product.title} fill sizes="56px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--app-text)]">{line.product.title}</p>
                      <p className="text-xs text-[var(--app-text-soft)] mt-0.5">
                        {formatPrice(line.product.price, line.product.currency, locale)} × {line.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" disabled={isCartBusy} onClick={() => void setProductQuantity(line.product.id, line.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] disabled:opacity-40">
                        <MinusIcon />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
                      <button type="button" disabled={isCartBusy} onClick={() => void setProductQuantity(line.product.id, line.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-accent)] text-white disabled:opacity-40">
                        <PlusIcon />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-[var(--app-border)] pt-3 px-2">
                  <span className="font-semibold text-[var(--app-text)]">{t.common.total}</span>
                  <span className="font-bold text-[var(--app-text)]">{formatPrice(cartTotal, "UZS", locale)}</span>
                </div>
              </div>

              {/* Checkout form */}
              <div className="store-panel rounded-[22px] p-4">
                <h2 className="font-bold text-[var(--app-text)] mb-3">{t.cart.checkoutTitle}</h2>
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void handleCheckout(); }}>
                  {orderState.type === "error" && (
                    <div className="rounded-[14px] bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {orderState.message}
                    </div>
                  )}
                  <input
                    value={form.customerName}
                    onChange={(e) => setForm((c) => ({ ...c, customerName: e.target.value }))}
                    className="store-input"
                    placeholder={t.cart.customerNamePlaceholder}
                  />
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                    className="store-input"
                    placeholder={t.cart.phonePlaceholder}
                    type="tel"
                  />
                  <button
                    type="button"
                    onClick={() => openLocation()}
                    className="w-full flex items-center gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-muted)] px-4 py-3 text-left transition-all active:scale-95"
                  >
                    <span className={form.address.trim() ? "text-[var(--app-accent)]" : "text-[var(--app-text-soft)]"}>
                      <LocationIcon />
                    </span>
                    <span className={`flex-1 text-sm ${form.address.trim() ? "text-[var(--app-text)]" : "text-[var(--app-text-soft)]"}`}>
                      {form.address.trim() || t.cart.addressPlaceholder}
                    </span>
                    <span className="text-xs text-[var(--app-accent)] font-medium shrink-0">
                      {form.address.trim() ? t.common.change : `${t.common.choose} →`}
                    </span>
                  </button>
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm((c) => ({ ...c, comment: e.target.value }))}
                    rows={2}
                    className="store-input resize-none"
                    placeholder={t.cart.commentPlaceholder}
                  />

                  {/* Payment */}
                  <div>
                    <p className="mb-2 text-sm text-[var(--app-text-soft)]">{t.cart.paymentTitle}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["cash", "click", "payme"] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setForm((c) => ({ ...c, paymentMethod: method }))}
                          className={`rounded-[14px] py-2.5 text-sm font-semibold transition ${form.paymentMethod === method
                            ? "bg-[var(--app-accent)] text-white"
                            : "bg-[var(--app-muted)] text-[var(--app-text-soft)]"
                            }`}
                        >
                          {translatePaymentMethod(locale, method)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || cartCount === 0}
                    className="w-full rounded-[16px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? t.cart.ordering : `${t.cart.orderButton} · ${formatPrice(cartTotal, "UZS", locale)}`}
                  </button>
                </form>
              </div>

              <button
                type="button"
                onClick={() => void clearCart()}
                disabled={isCartBusy}
                className="w-full text-center text-sm text-[var(--app-text-soft)] py-2 disabled:opacity-40"
              >
                {t.cart.clear}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function OrdersView() {
    return (
      <div className="fade-in">
        <div className="px-4 pb-3" style={{ paddingTop: `${topPad + 16}px` }}>
          <h1 className="text-xl font-bold text-[var(--app-text)]">{t.orders.title}</h1>
        </div>

        <div className="px-4 pb-6">
          {orderState.type === "success" && orderState.receipt && (
            <div className="store-panel rounded-[22px] p-4 mb-4 border-l-4 border-emerald-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckIcon />
                </span>
                <p className="font-semibold text-emerald-700">{t.orders.success}</p>
              </div>
              <p className="text-sm text-[var(--app-text-soft)]">
                #{orderState.receipt.orderId?.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-sm font-semibold text-[var(--app-text)] mt-1">
                {formatPrice(orderState.receipt.total, "UZS", locale)}
              </p>
            </div>
          )}

          {pastOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-5xl mb-4">📦</p>
              <p className="font-semibold text-[var(--app-text)] text-lg">{t.orders.emptyTitle}</p>
              <p className="text-sm text-[var(--app-text-soft)] mt-1">{t.orders.emptyDescription}</p>
              <button
                type="button"
                onClick={() => setView("catalog")}
                className="mt-5 rounded-[16px] bg-[var(--app-accent)] px-6 py-3 text-sm font-semibold text-white"
              >
                {t.orders.makeOrder}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pastOrders.map((order) => (
                <button
                  key={order.orderId}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="store-panel rounded-[22px] p-4 w-full text-left transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--app-text)]">
                        #{order.orderId.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-[var(--app-text-soft)] mt-0.5">
                        {new Intl.DateTimeFormat(intlLocale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(order.createdAt))}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {t.orders.accepted}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {order.lines.slice(0, 2).map((line) => (
                      <div key={line.productId} className="flex justify-between text-sm">
                        <span className="text-[var(--app-text-soft)] truncate mr-2">{line.title} × {line.quantity}</span>
                        <span className="font-medium text-[var(--app-text)] shrink-0">{formatPrice(line.lineTotal, "UZS", locale)}</span>
                      </div>
                    ))}
                    {order.lines.length > 2 && (
                      <p className="text-xs text-[var(--app-text-soft)]">{t.orders.moreItems(order.lines.length - 2)}</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--app-border)] pt-3">
                    <span className="text-sm text-[var(--app-text-soft)]">{t.common.total}</span>
                    <span className="font-bold text-[var(--app-accent)]">{formatPrice(order.total, "UZS", locale)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function ProfileView() {
    const user = session.user;
    const isAuth = session.backendAuthenticated;
    const phone = session.profile?.phone ?? form.phone;

    const menuItems = [
      {
        label: t.profile.ourBranches,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M7 7V5a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M12 12v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        ),
        href: "https://yandex.uz/maps/-/CPC6FN8j",
      },
      {
        label: t.profile.aboutCompany,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        ),
        href: `https://t.me/${app.botUsername}`,
      },
      {
        label: t.profile.publicOffer,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        ),
        href: `https://t.me/${app.botUsername}`,
      },
      {
        label: t.profile.privacyPolicy,
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6l-9-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
        href: `https://t.me/${app.botUsername}`,
      },
    ];

    return (
      <div className="fade-in pb-8" style={{ paddingTop: `${topPad + 8}px` }}>
        <div className="px-4 space-y-4">

          {/* ── Login card (not in Telegram) or User card ── */}
          {!inTelegram ? (
            <div className="rounded-3xl bg-[var(--app-surface-strong)] p-6 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="var(--app-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="font-bold text-[var(--app-text)] text-lg leading-snug">{t.profile.loginTitle}</p>
              <p className="text-sm text-[var(--app-text-soft)] leading-relaxed">{t.profile.loginBody}</p>
              <a
                href={`https://t.me/${app.botUsername}`}
                className="mt-1 w-full rounded-2xl bg-[var(--app-accent)] py-4 text-base font-bold text-white text-center block"
              >
                {t.profile.loginButton}
              </a>
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--app-surface-strong)] p-4 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] text-xl font-bold text-white">
                {user ? user.firstName.slice(0, 1).toUpperCase() : "?"}
              </div>
              <div className="min-w-0 flex-1">
                {user ? (
                  <>
                    <p className="font-bold text-[var(--app-text)]">
                      {user.firstName}{user.lastName ? ` ${user.lastName}` : ""}
                    </p>
                    {user.username && <p className="text-sm text-[var(--app-text-soft)]">@{user.username}</p>}
                    {phone && <p className="text-sm text-[var(--app-text-soft)]">{phone}</p>}
                  </>
                ) : (
                  <p className="text-[var(--app-text-soft)]">{t.profile.noUserData}</p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isAuth ? "bg-emerald-100 text-emerald-700" : "bg-[var(--app-muted)] text-[var(--app-text-soft)]"
              }`}>
                {isAuth ? t.common.authenticated : t.common.telegram}
              </span>
            </div>
          )}

          {/* ── Stats (only when logged in) ── */}
          {inTelegram && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--app-surface-strong)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--app-accent)]">{pastOrders.length}</p>
                <p className="text-xs text-[var(--app-text-soft)] mt-1">{t.profile.ordersStat}</p>
              </div>
              <div className="rounded-2xl bg-[var(--app-surface-strong)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--app-accent)]">{cartCount}</p>
                <p className="text-xs text-[var(--app-text-soft)] mt-1">{t.profile.cartStat}</p>
              </div>
            </div>
          )}

          {/* ── Contact us button ── */}
          <a
            href="tel:+998888088787"
            className="flex items-center justify-center gap-3 w-full rounded-2xl bg-[var(--app-accent)] py-4 text-base font-bold text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/>
            </svg>
            {t.profile.contactUs}
          </a>

          {/* ── Branch info card ── */}
          <a
            href="https://yandex.uz/maps/-/CPC6FN8j"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-3xl bg-[var(--app-surface-strong)] p-4 active:bg-[var(--app-muted)] transition-colors"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[var(--app-muted)] flex items-center justify-center shrink-0 mt-0.5 text-[var(--app-text-soft)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--app-text)] leading-snug">
                  ул. Сайрам, 6, Мирзо-Улугбекский район
                </p>
                <p className="text-xs text-[var(--app-text-soft)] mt-0.5">Ташкент</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[var(--app-text-soft)] shrink-0 mt-1">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="space-y-1.5 pl-12">
              <div className="flex items-center gap-2 text-xs text-[var(--app-text-soft)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                <span>09:00 – 22:30</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="var(--app-accent)"/></svg>
                <span className="text-[var(--app-accent)] font-medium">+998 88 808 87 87</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="var(--app-accent)"/></svg>
                <span className="text-[var(--app-accent)] font-medium">+998 99 726 43 44</span>
              </div>
            </div>
          </a>

          {/* ── Menu list ── */}
          <div className="rounded-3xl bg-[var(--app-surface-strong)] overflow-hidden">
            {menuItems.map((item, i) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-4 px-4 py-4 active:bg-[var(--app-muted)] transition-colors ${
                  i < menuItems.length - 1 ? "border-b border-[var(--app-border)]" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--app-muted)] flex items-center justify-center text-[var(--app-text-soft)] shrink-0">
                  {item.icon}
                </div>
                <span className="flex-1 text-sm font-medium text-[var(--app-text)]">{item.label}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[var(--app-text-soft)]">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            ))}
            {/* Language row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-t border-[var(--app-border)]">
              <div className="w-10 h-10 rounded-full bg-[var(--app-muted)] flex items-center justify-center text-[var(--app-text-soft)] shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 3c-2.5 3-4 5.7-4 9s1.5 6 4 9M12 3c2.5 3 4 5.7 4 9s-1.5 6-4 9M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="flex-1 text-sm font-medium text-[var(--app-text)]">{t.profile.appLanguage}</span>
              <div className="flex gap-1">
                {APP_LOCALES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => switchLocale(option)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                      option === locale
                        ? "bg-[var(--app-accent)] text-white"
                        : "bg-[var(--app-muted)] text-[var(--app-text-soft)]"
                    }`}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Social links ── */}
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm text-[var(--app-text-soft)] text-center">{t.profile.followUs}</p>
            <div className="flex gap-4">
              {/* Instagram */}
              <a href="https://www.instagram.com/croissant_eco/" target="_blank" rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-[var(--app-muted)] flex items-center justify-center text-[var(--app-text)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
                </svg>
              </a>
              {/* Telegram channel */}
              <a href="https://t.me/croissantbydeco" target="_blank" rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-[var(--app-muted)] flex items-center justify-center text-[var(--app-text)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M21.8 2.8L2.4 10.4c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 11.3-7.1c.5-.3 1-.1.6.2l-9.1 8.2v3.2c0 .7.3.9.8.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8L23 3.8c.3-1.2-.4-1.7-1.2-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>

          {/* ── Footer ── */}
          <p className="text-center text-xs text-[var(--app-text-soft)] pb-2">
            {t.profile.poweredBy} {app.brandName}
          </p>
        </div>
      </div>
    );
  }

  // ─── search overlay ───────────────────────────────────────────────────────

  function SearchOverlay() {
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
          <button
            type="button"
            onClick={() => { setSearchOpen(false); setQuery(""); }}
            className="text-sm font-semibold text-[var(--app-text)]"
          >
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
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-[18px] bg-[var(--app-surface)] border border-[var(--app-border)] p-3"
                    onClick={() => { setSearchOpen(false); setQuery(""); setSelectedProduct(product); }}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[var(--app-muted)]">
                      {product.imageUrl && (
                        <Image src={product.imageUrl} alt={product.title} fill sizes="48px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--app-text)]">{product.title}</p>
                      <p className="text-xs text-[var(--app-text-soft)]">{product.categoryTitle}</p>
                    </div>
                    <div className="shrink-0 text-right" onClick={(e) => e.stopPropagation()}>
                      <p className="text-sm font-bold text-[var(--app-text)]">{formatPrice(product.price, product.currency, locale)}</p>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => void setProductQuantity(product.id, 1)}
                          className="mt-1 rounded-full bg-[var(--app-accent)] px-3 py-1 text-xs font-semibold text-white"
                        >
                          {t.search.addButton}
                        </button>
                      ) : (
                        <QuantityControl
                          quantity={qty}
                          onDecrement={() => void setProductQuantity(product.id, qty - 1)}
                          onIncrement={() => void setProductQuantity(product.id, qty + 1)}
                          busy={isCartBusy}
                          size="sm"
                        />
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

  // ─── order detail sheet ───────────────────────────────────────────────────

  function OrderDetailSheet({ order }: { order: OrderReceipt }) {
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
    const statusLabels = t.delivery.steps.map((deliveryStep) => deliveryStep.label);

    const dragHandlers = makeSheetDragHandlers(
      sheetRef, sheetDragStartY, sheetDragCurrentY, sheetDragTime,
      () => setSelectedOrder(null),
    );

    return (
      <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
        <div className="absolute inset-0 bg-black/40 overlay-in" onClick={() => setSelectedOrder(null)} />
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
              {t.delivery.steps.map((s, i) => (
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
            // Interpolate courier lat/lon between restaurant and customer
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
                    apiKey={app.yandexMapsApiKey ?? ""}
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

  // ─── location modal ───────────────────────────────────────────────────────

  function LocationModal() {
    const draft = locationDraft;
    const setDraft = setLocationDraft;
    const locating = locationLocating;
    const setLocating = setLocationLocating;
    const locError = locationError;
    const setLocError = setLocationError;

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
      setForm((c) => ({ ...c, address: draft.trim() }));
      setLocationOpen(false);
    }

    const locDragHandlers = makeSheetDragHandlers(
      locSheetRef, locDragStart, locDragCurrent, locDragTime,
      () => setLocationOpen(false),
    );

    return (
      <div
        className="fixed inset-0 z-50 flex items-end"
        onClick={(e) => { if (e.target === e.currentTarget) setLocationOpen(false); }}
      >
        <div className="absolute inset-0 bg-black/40 overlay-in" onClick={() => setLocationOpen(false)} />
        <div ref={locSheetRef} className="relative z-10 w-full max-w-[430px] mx-auto rounded-t-[28px] bg-[var(--app-bg)] sheet-up"
          style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 20px)` }}>
          {/* Drag handle */}
          <div className="flex justify-center items-center cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ paddingTop: 14, paddingBottom: 14 }}
            {...locDragHandlers}>
            <div className="h-1.5 w-12 rounded-full bg-[var(--app-border)]" />
          </div>
          <div className="px-5 pb-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--app-text)]">{t.location.title}</h2>
              <button
                type="button"
                onClick={() => setLocationOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-muted)] text-[var(--app-text-soft)]"
              >
                <CloseIcon />
              </button>
            </div>

            {/* GPS button */}
            <button
              type="button"
              disabled={locating}
              onClick={() => void detectLocation()}
              className="w-full flex items-center gap-3 rounded-2xl bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/30 px-4 py-3.5 mb-4 transition-all active:scale-95 disabled:opacity-60"
            >
              <span className="text-[var(--app-accent)]"><LocationIcon /></span>
              <div className="text-left">
                <p className="text-sm font-semibold text-[var(--app-accent)]">
                  {locating ? t.location.locating : t.location.detectLocation}
                </p>
                <p className="text-xs text-[var(--app-text-soft)] mt-0.5">{t.location.gpsHint}</p>
              </div>
              {locating && (
                <svg className="ml-auto h-4 w-4 animate-spin text-[var(--app-accent)]" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              )}
            </button>

            {locError && (
              <p className="text-xs text-rose-500 mb-3 px-1">{locError}</p>
            )}

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

            <button
              type="button"
              disabled={!draft.trim()}
              onClick={save}
              className="w-full rounded-[16px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            >
              {t.common.saveAddress}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── product modal ────────────────────────────────────────────────────────

  function ProductModal({ product }: { product: CatalogProduct }) {
    const qty = getQuantity(product.id);
    const prodDragHandlers = makeSheetDragHandlers(
      prodSheetRef, prodDragStart, prodDragCurrent, prodDragTime,
      () => setSelectedProduct(null),
    );
    return (
      <div
        className="fixed inset-0 z-50 flex items-end"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}
      >
        <div className="absolute inset-0 bg-black/40 overlay-in" onClick={() => setSelectedProduct(null)} />
        <div ref={prodSheetRef} className="relative z-10 w-full max-w-[430px] mx-auto rounded-t-[28px] bg-[var(--app-bg)] overflow-hidden max-h-[85vh] flex flex-col sheet-up">
          {/* Drag handle */}
          <div className="flex justify-center items-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ paddingTop: 14, paddingBottom: 14 }}
            {...prodDragHandlers}>
            <div className="h-1.5 w-12 rounded-full bg-white/50" />
          </div>
          {/* Image */}
          <div className="relative aspect-[4/3] bg-[var(--app-muted)] shrink-0">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt={product.title} fill sizes="430px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">🥐</div>
            )}
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-5 flex-1">
            <p className="text-xs text-[var(--app-text-soft)] mb-1">{product.categoryTitle}</p>
            <h2 className="text-xl font-bold text-[var(--app-text)]">{product.title}</h2>
            {product.description && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-soft)]">
                {product.description}
              </p>
            )}
            {product.weight > 0 && (
              <p className="mt-2 text-xs text-[var(--app-text-soft)]">{t.common.weight}: {product.weight} g</p>
            )}
          </div>

          {/* CTA */}
          <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-bg)]">
            {qty === 0 ? (
              <button
                type="button"
                disabled={isCartBusy}
                onClick={() => { void setProductQuantity(product.id, 1); setSelectedProduct(null); }}
                className="w-full rounded-[18px] bg-[var(--app-accent)] py-4 text-base font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                {t.product.addToCart} · {formatPrice(product.price, product.currency, locale)}
              </button>
            ) : (
              <div className="flex items-center justify-between">
                <QuantityControl
                  quantity={qty}
                  onDecrement={() => void setProductQuantity(product.id, qty - 1)}
                  onIncrement={() => void setProductQuantity(product.id, qty + 1)}
                  busy={isCartBusy}
                />
                <button
                  type="button"
                  onClick={() => { setSelectedProduct(null); setView("cart"); }}
                  className="rounded-[18px] bg-[var(--app-accent)] px-5 py-3 text-sm font-bold text-white"
                >
                  {t.product.goToCart} →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── tab bar ──────────────────────────────────────────────────────────────

  const tabs = [
    { id: "catalog" as View, label: t.tabs.catalog, Icon: HomeIcon },
    { id: "cart" as View, label: t.tabs.cart, Icon: CartIcon },
    { id: "orders" as View, label: t.tabs.orders, Icon: ReceiptIcon },
    { id: "profile" as View, label: t.tabs.profile, Icon: UserIcon },
  ];

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]" style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}>
      {showSplash && <SplashScreen />}
      {/* Views */}
      {view === "catalog" && CatalogView()}
      {view === "cart" && CartView()}
      {view === "orders" && OrdersView()}
      {view === "profile" && ProfileView()}

      {/* Tab bar */}
      <nav className="store-tabbar">
        {tabs.map(({ id, label, Icon }) => {
          const active = view === id;
          const badge = id === "cart" ? cartCount : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`store-tab ${active ? "active" : ""}`}
            >
              <span className={`store-tab-icon ${active ? "active" : ""} relative`}>
                <Icon filled={active} />
                {badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Overlays */}
      {selectedOrder && OrderDetailSheet({ order: selectedOrder })}
      {locationOpen && LocationModal()}
      {mapPickerOpen && (
        <YandexMapPicker
          apiKey={app.yandexMapsApiKey ?? ""}
          lang={locale === "uz" ? "uz_UZ" : locale === "en" ? "en_US" : "ru_RU"}
          initialCoords={locationCoords ?? undefined}
          topOffset={topPad}
          saveLabel={t.common.saveAddress}
          detectingLabel={t.location.locating}
          detectLocationLabel={t.location.detectLocation}
          onClose={() => setMapPickerOpen(false)}
          onSave={(addr, c) => {
            if (addr) setForm((f) => ({ ...f, address: addr }));
            setLocationCoords(c);
            setMapPickerOpen(false);
          }}
        />
      )}
      {searchOpen && <SearchOverlay />}
      {selectedProduct && <ProductModal product={selectedProduct} />}
    </main>
  );
}
