import {
  BackendApiError,
  removeBackendCartItem,
  updateBackendCartItem,
} from "@/lib/backend-api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-session";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    itemId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
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
    const { itemId } = await context.params;
    const payload = (await request.json()) as { quantity?: number };
    const cart = await updateBackendCartItem(
      token,
      itemId,
      Math.max(0, Math.min(100, Math.trunc(payload.quantity ?? 0))),
    );

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
        error: "Failed to update backend cart item.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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
    const { itemId } = await context.params;
    const cart = await removeBackendCartItem(token, itemId);
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
        error: "Failed to remove backend cart item.",
      },
      { status: 500 },
    );
  }
}
