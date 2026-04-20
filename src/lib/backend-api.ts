import "server-only";
import type { AppLocale } from "@/lib/i18n";
import {
  normalizeLocale,
  pickLocalizedText,
} from "@/lib/i18n";
import type {
  BackendCart,
  BackendCategory,
  BackendOrder,
  BackendPaginatedResponse,
  BackendProduct,
  BackendTokenResponse,
  BackendUser,
  CartLineInput,
  CatalogCategory,
  CatalogProduct,
  CatalogSnapshot,
  OrderFormInput,
  OrderLine,
  OrderReceipt,
  TelegramMiniAppUser,
} from "@/lib/types";
import { getServerConfig } from "@/lib/server-config";

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getBackendBaseUrl() {
  return trimTrailingSlash(getServerConfig().backendApiBaseUrl);
}

export function isBackendApiConfigured() {
  return Boolean(getBackendBaseUrl());
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickBackendText(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function readErrorMessage(payload: unknown, fallbackStatus: number) {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const joined = detail
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return "";
          }

          const message = (entry as { msg?: unknown }).msg;
          return typeof message === "string" ? message : "";
        })
        .filter(Boolean)
        .join("; ");

      if (joined) {
        return joined;
      }
    }

    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return `Backend API request failed with status ${fallbackStatus}.`;
}

async function backendApiFetch<T>(
  path: string,
  init: RequestInit = {},
  token = "",
): Promise<T> {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new BackendApiError("BACKEND_API_BASE_URL is not configured.", 503);
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new BackendApiError(
      readErrorMessage(payload, response.status),
      response.status,
      payload,
    );
  }

  return payload as T;
}

function buildCategoryTitle(category: BackendCategory, locale: AppLocale) {
  const base = pickLocalizedText(
    locale,
    {
      ru: category.name_ru,
      uz: category.name_uz,
      en: category.name_en,
    },
    [category.name],
  ) || pickBackendText(category.name_ru, category.name_uz, category.name_en, category.name);
  return category.emoji ? `${category.emoji} ${base}`.trim() : base;
}

function buildProductTitle(product: BackendProduct, locale: AppLocale) {
  return (
    pickLocalizedText(
      locale,
      {
        ru: product.name_ru,
        uz: product.name_uz,
        en: product.name_en,
      },
      [product.name],
    ) ||
    pickBackendText(
      product.name_ru,
      product.name_uz,
      product.name_en,
      product.name,
      "Product",
    )
  );
}

function buildProductDescription(product: BackendProduct, locale: AppLocale) {
  return (
    pickLocalizedText(
      locale,
      {
        ru: product.description_ru,
        uz: product.description_uz,
        en: product.description_en,
      },
      [product.description],
    ) ||
    pickBackendText(
      product.description_ru,
      product.description_uz,
      product.description_en,
      product.description,
    )
  );
}

function adaptProduct(
  product: BackendProduct,
  locale: AppLocale,
  categoryTitle: string,
  categoryId: string,
): CatalogProduct {
  return {
    id: product.id,
    slug: product.id,
    title: buildProductTitle(product, locale),
    description: buildProductDescription(product, locale),
    price: toNumber(product.price),
    currency: "UZS",
    imageUrl: product.image_url,
    categoryId,
    categoryTitle,
    rating: 0,
    weight: 0,
    hasModifier: false,
    isActive: product.is_active,
  };
}

function adaptCatalog(
  locale: AppLocale,
  categories: BackendCategory[],
  products: BackendProduct[],
): CatalogSnapshot {
  const normalizedCategories: CatalogCategory[] = categories
    .filter((category) => category.is_active)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((category) => {
      const title = buildCategoryTitle(category, locale);
      const categoryProducts = products
        .filter(
          (product) => product.is_active && product.category_id === category.id,
        )
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((product) => adaptProduct(product, locale, title, category.id));

      return {
        id: category.id,
        slug: category.id,
        title,
        description: "",
        imageUrl: categoryProducts[0]?.imageUrl ?? null,
        productCount: categoryProducts.length,
        products: categoryProducts,
      };
    })
    .filter((category) => category.products.length > 0);

  const featuredProducts = normalizedCategories
    .flatMap((category) => category.products)
    .slice()
    .sort((left, right) => left.price - right.price)
    .slice(0, 6);

  return {
    restaurantName: getServerConfig().brandName,
    sourceUrl: getBackendBaseUrl(),
    sourceKind: "backend-api",
    locale,
    updatedAt: new Date().toISOString(),
    totalProducts: normalizedCategories.reduce(
      (total, category) => total + category.productCount,
      0,
    ),
    categories: normalizedCategories,
    featuredProducts,
  };
}

function buildDeliveryComment(comment: string, deliveryTime: string) {
  const cleanComment = comment.replace(/\s+/g, " ").trim();
  const cleanTime = deliveryTime.replace(/\s+/g, " ").trim();

  if (!cleanTime && !cleanComment) {
    return null;
  }

  if (!cleanComment) {
    return `Delivery time: ${cleanTime}`;
  }

  if (!cleanTime) {
    return cleanComment;
  }

  return `Delivery time: ${cleanTime}\nComment: ${cleanComment}`;
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function buildOrderLines(items: BackendOrder["items"]): OrderLine[] {
  return items.map((item) => ({
    productId: item.product_id ?? item.id,
    title: item.product_name,
    quantity: item.quantity,
    unitPrice: toNumber(item.price),
    lineTotal: toNumber(item.subtotal),
    categoryTitle: "",
  }));
}

export async function authenticateTelegramUserWithBackend(
  user: TelegramMiniAppUser,
) {
  return backendApiFetch<BackendTokenResponse>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({
      telegram_id: Number(user.id),
      full_name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
      username: user.username ?? null,
      language_code: user.languageCode ?? "ru",
    }),
  });
}

export async function updateBackendProfile(
  token: string,
  payload: {
    fullName: string;
    phone: string;
    languageCode?: string;
  },
) {
  return backendApiFetch<BackendUser>(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify({
        full_name: payload.fullName.trim(),
        phone: normalizePhone(payload.phone),
        language_code: payload.languageCode ?? "ru",
      }),
    },
    token,
  );
}

export async function fetchBackendCatalogSnapshot(locale: AppLocale) {
  const [categories, products] = await Promise.all([
    backendApiFetch<BackendCategory[]>("/categories"),
    fetchAllBackendProducts(),
  ]);

  return adaptCatalog(locale, categories, products);
}

async function fetchAllBackendProducts() {
  const products: BackendProduct[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const payload = await backendApiFetch<BackendPaginatedResponse<BackendProduct>>(
      `/products?page=${page}&size=100`,
    );

    products.push(...payload.items);
    totalPages = Math.max(1, payload.pages);
    page += 1;
  }

  return products;
}

export async function fetchBackendCart(token: string) {
  return backendApiFetch<BackendCart>("/cart", {}, token);
}

export async function addBackendCartItem(
  token: string,
  payload: { productId: string; quantity: number },
) {
  return backendApiFetch<BackendCart>(
    "/cart/items",
    {
      method: "POST",
      body: JSON.stringify({
        product_id: payload.productId,
        quantity: payload.quantity,
      }),
    },
    token,
  );
}

export async function updateBackendCartItem(
  token: string,
  itemId: string,
  quantity: number,
) {
  return backendApiFetch<BackendCart>(
    `/cart/items/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    },
    token,
  );
}

export async function removeBackendCartItem(token: string, itemId: string) {
  return backendApiFetch<BackendCart>(
    `/cart/items/${itemId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export async function clearBackendCart(token: string) {
  return backendApiFetch<BackendCart>(
    "/cart",
    {
      method: "DELETE",
    },
    token,
  );
}

export async function syncBackendCart(token: string, items: CartLineInput[]) {
  await clearBackendCart(token);

  for (const item of items) {
    const quantity = Math.max(1, Math.min(100, Math.trunc(item.quantity)));
    await addBackendCartItem(token, {
      productId: item.productId,
      quantity,
    });
  }

  return fetchBackendCart(token);
}

export async function createBackendOrder(
  token: string,
  payload: OrderFormInput,
) {
  return backendApiFetch<BackendOrder>(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({
        address: payload.address.replace(/\s+/g, " ").trim(),
        comment: buildDeliveryComment(payload.comment, payload.deliveryTime),
        payment_method: payload.paymentMethod,
        idempotency_key: payload.idempotencyKey ?? null,
      }),
    },
    token,
  );
}

export function adaptBackendOrderToReceipt(
  order: BackendOrder,
  payload: OrderFormInput,
  telegramUser: TelegramMiniAppUser | null,
): OrderReceipt {
  const locale = normalizeLocale(payload.locale);

  return {
    orderId: order.id,
    total: toNumber(order.total_price),
    currency: "UZS",
    locale,
    customerName: payload.customerName.trim(),
    phone: normalizePhone(payload.phone),
    address: order.address,
    comment: payload.comment.trim(),
    paymentMethod: order.payment_method ?? payload.paymentMethod,
    deliveryMode: "delivery",
    deliveryTime: payload.deliveryTime.trim() || "",
    createdAt: order.created_at,
    lines: buildOrderLines(order.items),
    source: "backend-api",
    telegramUser,
    startParam: payload.startParam ?? null,
    status: order.status,
  };
}
