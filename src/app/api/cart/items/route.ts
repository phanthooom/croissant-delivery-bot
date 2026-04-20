import { addBackendCartItem, BackendApiError } from "@/lib/backend-api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = await getBackendAccessTokenFromCookies();

  if (!token) {
    return Response.json(
      {
        ok: false,
        error: "Telegram backend session is missing.",
      },
      { status: 401 },
    );
  }

  try {
    const payload = (await request.json()) as {
      productId?: string;
      quantity?: number;
    };

    const cart = await addBackendCartItem(token, {
      productId: payload.productId ?? "",
      quantity: Math.max(1, Math.min(100, Math.trunc(payload.quantity ?? 1))),
    });

    return Response.json({ ok: true, cart });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        error: "Failed to add item to backend cart.",
      },
      { status: 500 },
    );
  }
}
