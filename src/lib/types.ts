export interface LocalizedField {
  uz?: string;
  ru?: string;
  en?: string;
  kk?: string;
  [key: string]: string | undefined;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  categoryId: string;
  categoryTitle: string;
  rating: number;
  weight: number;
  hasModifier: boolean;
  isActive: boolean;
}

export interface CatalogCategory {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  productCount: number;
  products: CatalogProduct[];
}

export interface CatalogSnapshot {
  restaurantName: string;
  sourceUrl: string;
  sourceKind: "backend-api" | "website-parser";
  locale: string;
  updatedAt: string;
  totalProducts: number;
  categories: CatalogCategory[];
  featuredProducts: CatalogProduct[];
}

export interface PublicAppConfig {
  brandName: string;
  botUsername: string;
  miniAppUrl: string;
  supportPhone: string | null;
  catalogSourceUrl: string;
  orderSlaMinutes: number;
  yandexMapsApiKey: string | null;
}

export interface ServerCapabilities {
  canValidateTelegramSession: boolean;
  canSendOrdersToTelegram: boolean;
  hasWebhookSecret: boolean;
  hasBackendApi: boolean;
  canUseBackendCheckout: boolean;
  allowCatalogFallback: boolean;
}

export interface TelegramMiniAppUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  photoUrl?: string;
  allowsWriteToPm?: boolean;
}

export interface BackendUser {
  id: string;
  telegram_id: number;
  full_name: string;
  username: string | null;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN";
  is_active: boolean;
  language_code: string;
  created_at: string;
}

export interface TelegramSessionInfo {
  verified: boolean;
  initDataPresent: boolean;
  startParam: string | null;
  user: TelegramMiniAppUser | null;
  backendEnabled: boolean;
  backendAuthenticated: boolean;
  mode: "preview" | "backend";
  profile: BackendUser | null;
}

export interface CartLineInput {
  productId: string;
  quantity: number;
}

export interface OrderFormInput {
  customerName: string;
  phone: string;
  address: string;
  comment: string;
  paymentMethod: "cash" | "click" | "payme";
  deliveryMode: "delivery";
  deliveryTime: string;
  startParam?: string | null;
  initData?: string;
  locale?: string;
  items: CartLineInput[];
  previewUser?: TelegramMiniAppUser | null;
  idempotencyKey?: string;
  useBackendOrder?: boolean;
}

export interface OrderLine {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  categoryTitle: string;
}

export interface OrderReceipt {
  orderId: string;
  total: number;
  currency: string;
  locale?: string;
  customerName: string;
  phone: string;
  address: string;
  comment: string;
  paymentMethod: "cash" | "click" | "payme";
  deliveryMode: "delivery";
  deliveryTime: string;
  createdAt: string;
  lines: OrderLine[];
  source: "backend-api" | "telegram-chat" | "preview";
  telegramUser: TelegramMiniAppUser | null;
  startParam: string | null;
  status?: string;
}

export interface BackendCategory {
  id: string;
  name: string;
  name_en?: string | null;
  name_uz: string | null;
  name_ru: string | null;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BackendProduct {
  id: string;
  name: string;
  name_en?: string | null;
  name_uz: string | null;
  name_ru: string | null;
  description: string | null;
  description_en?: string | null;
  description_uz: string | null;
  description_ru: string | null;
  price: number | string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  category_id: string | null;
  category: BackendCategory | null;
  created_at: string;
}

export interface BackendTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: BackendUser;
}

export interface BackendPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface BackendCartItem {
  id: string;
  product_id: string;
  product: BackendProduct;
  quantity: number;
  subtotal: number | string;
}

export interface BackendCart {
  id: string;
  user_id: string;
  items: BackendCartItem[];
  total_price: number | string;
  item_count: number;
}

export interface BackendOrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  price: number | string;
  quantity: number;
  subtotal: number | string;
}

export interface BackendOrder {
  id: string;
  user_id: string | null;
  total_price: number | string;
  status: string;
  address: string;
  comment: string | null;
  payment_method: "cash" | "click" | "payme" | null;
  paid_at: string | null;
  items: BackendOrderItem[];
  created_at: string;
}
