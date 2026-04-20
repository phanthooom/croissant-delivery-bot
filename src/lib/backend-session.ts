import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { BackendTokenResponse } from "@/lib/types";

const ACCESS_COOKIE = "fooddd_backend_access";
const REFRESH_COOKIE = "fooddd_backend_refresh";

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export function applyBackendSessionCookies(
  response: NextResponse,
  session: BackendTokenResponse,
) {
  response.cookies.set(
    ACCESS_COOKIE,
    session.access_token,
    buildCookieOptions(60 * 60),
  );
  response.cookies.set(
    REFRESH_COOKIE,
    session.refresh_token,
    buildCookieOptions(60 * 60 * 24 * 30),
  );
}

export function clearBackendSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", buildCookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", buildCookieOptions(0));
}

export async function getBackendAccessTokenFromCookies() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? "";
}
