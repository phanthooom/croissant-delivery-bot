import "server-only";
import vm from "node:vm";
import type { AppLocale } from "@/lib/i18n";
import { pickLocalizedFieldValue } from "@/lib/i18n";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogSnapshot,
  LocalizedField,
} from "@/lib/types";
import { getServerConfig } from "@/lib/server-config";

interface RawProduct {
  id: string;
  slug?: string;
  out_price?: number;
  currency?: string;
  image?: string;
  title?: LocalizedField;
  description?: LocalizedField;
  active?: boolean;
  active_in_menu?: boolean;
  has_modifier?: boolean;
  rating?: number;
  weight?: number;
}

interface RawCategory {
  id: string;
  slug?: string;
  image?: string;
  title?: LocalizedField;
  description?: LocalizedField;
  active?: boolean;
  products?: RawProduct[];
}

function buildCdnUrl(assetId: string | undefined) {
  if (!assetId) {
    return null;
  }

  if (assetId.startsWith("http://") || assetId.startsWith("https://")) {
    return assetId;
  }

  return `https://cdn.delever.uz/delever/${assetId}`;
}

function humanizeSlug(slug: string | undefined) {
  if (!slug) {
    return "Category";
  }

  const label = slug.replace(/[-_]+/g, " ").trim();
  return label ? label[0].toUpperCase() + label.slice(1) : "Category";
}

function extractJsonArray(source: string, token: string) {
  const tokenIndex = source.indexOf(token);
  if (tokenIndex === -1) {
    throw new Error("Categories payload token not found in source markup.");
  }

  const arrayStart = source.indexOf("[", tokenIndex);
  if (arrayStart === -1) {
    throw new Error("Categories JSON array start not found.");
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === "\\") {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(arrayStart, index + 1);
      }
    }
  }

  throw new Error("Categories JSON array end not found.");
}

function decodeRscStrings(html: string) {
  const inlineScripts = [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.includes("self.__next_f.push"));

  const pushes: unknown[] = [];
  const context = {
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    self: {
      __next_f: {
        push(value: unknown) {
          pushes.push(value);
        },
      },
    },
  };

  vm.createContext(context);

  for (const script of inlineScripts) {
    try {
      vm.runInContext(script, context);
    } catch {
      continue;
    }
  }

  return pushes.flatMap((entry) =>
    Array.isArray(entry)
      ? entry.filter((value): value is string => typeof value === "string")
      : [],
  );
}

function normalizeCatalog(
  rawCategories: RawCategory[],
  locale: AppLocale,
  sourceUrl: string,
  restaurantName: string,
): CatalogSnapshot {
  const categories: CatalogCategory[] = [];

  for (const category of rawCategories) {
    if (!category.active) {
      continue;
    }

    const title =
      pickLocalizedFieldValue(category.title, locale) ||
      humanizeSlug(category.slug);

    const products: CatalogProduct[] = (category.products ?? [])
      .filter((product) => product.active && product.active_in_menu)
      .map((product) => ({
        id: product.id,
        slug: product.slug ?? product.id,
        title:
          pickLocalizedFieldValue(product.title, locale) ||
          humanizeSlug(product.slug) ||
          "Product",
        description: pickLocalizedFieldValue(product.description, locale),
        price: product.out_price ?? 0,
        currency: product.currency ?? "UZS",
        imageUrl: buildCdnUrl(product.image),
        categoryId: category.id,
        categoryTitle: title,
        rating: product.rating ?? 0,
        weight: product.weight ?? 0,
        hasModifier: Boolean(product.has_modifier),
        isActive: Boolean(product.active && product.active_in_menu),
      }));

    if (products.length === 0) {
      continue;
    }

    categories.push({
      id: category.id,
      slug: category.slug ?? category.id,
      title,
      description: pickLocalizedFieldValue(category.description, locale),
      imageUrl: buildCdnUrl(category.image),
      productCount: products.length,
      products,
    });
  }

  const featuredProducts = categories
    .flatMap((category) => category.products)
    .filter((product) => product.imageUrl)
    .sort((left, right) => right.rating - left.rating || left.price - right.price)
    .slice(0, 6);

  return {
    restaurantName,
    sourceUrl,
    sourceKind: "website-parser",
    locale,
    updatedAt: new Date().toISOString(),
    totalProducts: categories.reduce(
      (total, category) => total + category.productCount,
      0,
    ),
    categories,
    featuredProducts,
  };
}

export async function getWebsiteCatalog(locale: AppLocale) {
  const config = getServerConfig();
  const response = await fetch(config.catalogSourceUrl, {
    headers: {
      "User-Agent": "CroissantTelegramMiniApp/1.0",
    },
    next: {
      revalidate: 300,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load catalog source: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  const strings = decodeRscStrings(html);
  const payload = strings.find((entry) =>
    entry.includes('"data":{"categories":['),
  );

  if (!payload) {
    throw new Error("Unable to locate categories payload in source HTML.");
  }

  const categoriesJson = extractJsonArray(payload, '"data":{"categories":');
  const rawCategories = JSON.parse(categoriesJson) as RawCategory[];

  return normalizeCatalog(
    rawCategories,
    locale,
    config.catalogSourceUrl,
    config.brandName,
  );
}
