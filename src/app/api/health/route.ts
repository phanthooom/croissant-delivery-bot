import { getServerCapabilities, getServerConfig } from "@/lib/server-config";

export const runtime = "nodejs";

export async function GET() {
  const config = getServerConfig();

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    capabilities: getServerCapabilities(),
    runtime: {
      backendApiBaseUrl: config.backendApiBaseUrl || null,
      catalogSourceUrl: config.catalogSourceUrl,
    },
  });
}
