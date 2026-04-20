import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import MiniAppShell from "@/components/mini-app-shell";
import { getCatalog } from "@/lib/catalog";
import {
  getPreferredLocale,
  getTranslations,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
} from "@/lib/i18n";
import { getPublicConfig } from "@/lib/public-config";
import { getServerCapabilities } from "@/lib/server-config";

export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslations("ru");
  return {
    title: t.metadata.pageTitle,
    description: t.metadata.pageDescription,
  };
}

export default async function Home() {
  const cookieStore = await cookies();
  const headersStore = await headers();
  const locale = normalizeLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value ??
    getPreferredLocale(headersStore.get("accept-language")),
  );

  const [catalog, publicConfig, capabilities] = await Promise.all([
    getCatalog(locale),
    Promise.resolve(getPublicConfig()),
    Promise.resolve(getServerCapabilities()),
  ]);

  return (
    <MiniAppShell
      initialCatalog={catalog}
      app={publicConfig}
      capabilities={capabilities}
      initialLocale={locale}
    />
  );
}
