import { normalizeLocale } from "@/lib/i18n";
import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const catalog = await getCatalog(normalizeLocale(searchParams.get("locale")));
  return Response.json(catalog, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
