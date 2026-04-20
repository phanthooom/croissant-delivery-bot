import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { fetchBackendCatalogSnapshot, isBackendApiConfigured } from "@/lib/backend-api";
import type { AppLocale } from "@/lib/i18n";
import { getServerConfig } from "@/lib/server-config";
import { getWebsiteCatalog } from "@/lib/website-catalog";

// Cached across all requests for 60s, revalidates in background up to 5min
const fetchCatalogCached = unstable_cache(
  async (locale: AppLocale) => {
    const config = getServerConfig();

    if (isBackendApiConfigured()) {
      try {
        const snapshot = await fetchBackendCatalogSnapshot(locale);
        if (snapshot.totalProducts > 0 || !config.allowCatalogFallback) {
          return snapshot;
        }
        console.warn("Backend catalog is empty, falling back to website parser.");
      } catch (error) {
        if (!config.allowCatalogFallback) throw error;
        console.warn("Backend catalog fetch failed, falling back to website parser.", error);
      }
    }

    return getWebsiteCatalog(locale);
  },
  ["catalog"],
  { revalidate: 60, tags: ["catalog"] },
);

// React cache deduplicates within a single request (SSR render)
export const getCatalog = cache(fetchCatalogCached);
