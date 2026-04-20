import { getIntlLocale, normalizeLocale } from "@/lib/i18n";

export function formatPrice(value: number, currency = "UZS", locale = "ru") {
  return new Intl.NumberFormat(getIntlLocale(normalizeLocale(locale)), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(
  iso: string,
  locale = "ru",
  options: Intl.DateTimeFormatOptions & { timeZone?: string } = {},
) {
  const { timeZone = "Asia/Tashkent", ...rest } = options;
  const formatOptions = Object.keys(rest).length > 0
    ? { timeZone, ...rest }
    : ({
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      } satisfies Intl.DateTimeFormatOptions);

  return new Intl.DateTimeFormat(
    getIntlLocale(normalizeLocale(locale)),
    formatOptions,
  ).format(new Date(iso));
}

export function buildMiniAppDeepLink(
  botUsername: string,
  startParam = "croissant",
) {
  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(startParam)}`;
}

export function compactNumber(value: number, locale = "ru") {
  return new Intl.NumberFormat(getIntlLocale(normalizeLocale(locale)), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
