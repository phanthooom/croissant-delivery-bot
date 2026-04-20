import "server-only";
import type { ServerCapabilities } from "@/lib/types";

export interface ServerConfig {
  brandName: string;
  botUsername: string;
  miniAppUrl: string;
  backendApiBaseUrl: string;
  catalogSourceUrl: string;
  catalogLocale: string;
  allowCatalogFallback: boolean;
  supportPhone: string;
  botToken: string;
  adminChatId: string;
  webhookUrl: string;
  webhookSecret: string;
  authMaxAgeSeconds: number;
  orderSlaMinutes: number;
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value !== "false" && value !== "0";
}

export function getServerConfig(): ServerConfig {
  return {
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Croissant",
    botUsername:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "fooddddelivery_bot",
    miniAppUrl:
      process.env.NEXT_PUBLIC_MINI_APP_URL ?? "http://localhost:3000",
    backendApiBaseUrl: process.env.BACKEND_API_BASE_URL ?? "",
    catalogSourceUrl:
      process.env.CATALOG_SOURCE_URL ?? "https://croissant.delever.uz/ru",
    catalogLocale: process.env.CATALOG_LOCALE ?? "ru",
    allowCatalogFallback: readBoolean(process.env.ALLOW_CATALOG_FALLBACK, true),
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "",
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? "",
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? "",
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
    authMaxAgeSeconds: readNumber(process.env.TELEGRAM_AUTH_MAX_AGE, 86400),
    orderSlaMinutes: readNumber(process.env.ORDER_SLA_MINUTES, 15),
  };
}

export function getServerCapabilities(): ServerCapabilities {
  const config = getServerConfig();

  return {
    canValidateTelegramSession: Boolean(config.botToken),
    canSendOrdersToTelegram: Boolean(config.botToken && config.adminChatId),
    hasWebhookSecret: Boolean(config.webhookSecret),
    hasBackendApi: Boolean(config.backendApiBaseUrl),
    canUseBackendCheckout: Boolean(config.backendApiBaseUrl && config.botToken),
    allowCatalogFallback: config.allowCatalogFallback,
  };
}
