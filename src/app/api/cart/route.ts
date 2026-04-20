import {
  BackendApiError,
  clearBackendCart,
  fetchBackendCart,
} from "@/lib/backend-api";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-session";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return Response.json(
    {
      ok: false,
      error: "Telegram backend session is missing.",
    },
    { status: 401 },
  );
}

export async function GET() {
  const token = await getBackendAccessTokenFromCookies();

  if (!token) {
    return unauthorizedResponse();
  }

  try {
    const cart = await fetchBackendCart(token);
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
        error: "Failed to load backend cart.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const token = await getBackendAccessTokenFromCookies();

  if (!token) {
    return unauthorizedResponse();
  }

  try {
    const cart = await clearBackendCart(token);
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
        error: "Failed to clear backend cart.",
      },
      { status: 500 },
    );
  }
}
