import { NextResponse } from "next/server";
import {
  authenticateTelegramUserWithBackend,
  BackendApiError,
} from "@/lib/backend-api";
import {
  applyBackendSessionCookies,
  clearBackendSessionCookies,
} from "@/lib/backend-session";
import { getServerCapabilities, getServerConfig } from "@/lib/server-config";
import {
  getStartParamFromInitData,
  validateTelegramInitData,
} from "@/lib/telegram-auth";

export const runtime = "nodejs";

function buildBaseSession(startParam: string | null) {
  const capabilities = getServerCapabilities();

  return {
    verified: false,
    initDataPresent: false,
    startParam,
    user: null,
    backendEnabled: capabilities.hasBackendApi,
    backendAuthenticated: false,
    mode: "preview" as const,
    profile: null,
  };
}

export async function POST(request: Request) {
  const { initData } = (await request.json()) as { initData?: string };
  const config = getServerConfig();
  const capabilities = getServerCapabilities();
  const startParam = initData ? getStartParamFromInitData(initData) : null;

  if (!initData) {
    const response = NextResponse.json(buildBaseSession(startParam));
    clearBackendSessionCookies(response);
    return response;
  }

  if (!config.botToken) {
    const response = NextResponse.json({
      ...buildBaseSession(startParam),
      initDataPresent: true,
      startParam,
    });
    clearBackendSessionCookies(response);
    return response;
  }

  const validation = validateTelegramInitData(
    initData,
    config.botToken,
    config.authMaxAgeSeconds,
  );

  if (!validation.valid) {
    const response = NextResponse.json(
      {
        ...validation.session,
        backendEnabled: capabilities.hasBackendApi,
        backendAuthenticated: false,
        mode: "preview" as const,
        profile: null,
        reason: validation.reason,
      },
      { status: 401 },
    );
    clearBackendSessionCookies(response);
    return response;
  }

  if (!capabilities.hasBackendApi || !validation.session.user) {
    const response = NextResponse.json({
      ...validation.session,
      backendEnabled: capabilities.hasBackendApi,
      backendAuthenticated: false,
      mode: "preview" as const,
      profile: null,
    });
    clearBackendSessionCookies(response);
    return response;
  }

  try {
    const backendSession = await authenticateTelegramUserWithBackend(
      validation.session.user,
    );
    const response = NextResponse.json({
      ...validation.session,
      backendEnabled: true,
      backendAuthenticated: true,
      mode: "backend" as const,
      profile: backendSession.user,
    });

    applyBackendSessionCookies(response, backendSession);
    return response;
  } catch (error) {
    const response = NextResponse.json({
      ...validation.session,
      backendEnabled: true,
      backendAuthenticated: false,
      mode: "preview" as const,
      profile: null,
      reason:
        error instanceof BackendApiError ? error.message : "backend_auth_failed",
    });
    clearBackendSessionCookies(response);
    return response;
  }
}
