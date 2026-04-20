import { getBackendAccessTokenFromCookies } from "@/lib/backend-session";
import { getServerCapabilities } from "@/lib/server-config";
import type { BackendOrder } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const capabilities = getServerCapabilities();
  if (!capabilities.hasBackendApi) {
    // No backend — return a simulated progressing status for demo
    return Response.json({ ok: true, status: "preparing" });
  }

  const token = await getBackendAccessTokenFromCookies();
  if (!token) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${process.env.BACKEND_API_BASE_URL}/orders/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return Response.json({ ok: false }, { status: res.status });
    }

    const order = (await res.json()) as BackendOrder;
    return Response.json({ ok: true, status: order.status });
  } catch {
    return Response.json({ ok: false, error: "Backend unreachable" }, { status: 502 });
  }
}
