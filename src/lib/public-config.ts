import type { PublicAppConfig } from "@/lib/types";

const DEFAULT_BOT_USERNAME = "fooddddelivery_bot";

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPublicConfig(): PublicAppConfig {
  return {
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Croissant",
    botUsername:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? DEFAULT_BOT_USERNAME,
    miniAppUrl:
      process.env.NEXT_PUBLIC_MINI_APP_URL ?? "http://localhost:3000",
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? null,
    catalogSourceUrl:
      process.env.BACKEND_API_BASE_URL ||
      process.env.CATALOG_SOURCE_URL ||
      "https://croissant.delever.uz/ru",
    orderSlaMinutes: readNumber(process.env.ORDER_SLA_MINUTES, 15),
  };
}
