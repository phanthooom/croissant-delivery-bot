import "server-only";
import crypto from "node:crypto";
import type { TelegramMiniAppUser, TelegramSessionInfo } from "@/lib/types";

export interface TelegramValidationResult {
  valid: boolean;
  reason?: string;
  authDate: number | null;
  queryId: string | null;
  session: TelegramSessionInfo;
}

function parseUser(raw: string | null): TelegramMiniAppUser | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
      allows_write_to_pm?: boolean;
    };

    if (!parsed.id || !parsed.first_name) {
      return null;
    }

    return {
      id: String(parsed.id),
      firstName: parsed.first_name,
      lastName: parsed.last_name,
      username: parsed.username,
      languageCode: parsed.language_code,
      isPremium: parsed.is_premium,
      photoUrl: parsed.photo_url,
      allowsWriteToPm: parsed.allows_write_to_pm,
    };
  } catch {
    return null;
  }
}

function buildSession(
  overrides: Partial<TelegramSessionInfo>,
): TelegramSessionInfo {
  return {
    verified: false,
    initDataPresent: false,
    startParam: null,
    user: null,
    backendEnabled: false,
    backendAuthenticated: false,
    mode: "preview",
    profile: null,
    ...overrides,
  };
}

export function getStartParamFromInitData(initData: string) {
  const params = new URLSearchParams(initData);
  return params.get("start_param");
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): TelegramValidationResult {
  if (!initData) {
    return {
      valid: false,
      reason: "missing_init_data",
      authDate: null,
      queryId: null,
      session: buildSession({
        verified: false,
        initDataPresent: false,
      }),
    };
  }

  if (!botToken) {
    return {
      valid: false,
      reason: "missing_bot_token",
      authDate: null,
      queryId: null,
      session: buildSession({
        initDataPresent: true,
        startParam: getStartParamFromInitData(initData),
      }),
    };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const queryId = params.get("query_id");
  const startParam = params.get("start_param");
  const user = parseUser(params.get("user"));

  if (!hash) {
    return {
      valid: false,
      reason: "missing_hash",
      authDate: Number.isFinite(authDate) ? authDate : null,
      queryId,
      session: buildSession({
        initDataPresent: true,
        startParam,
        user,
      }),
    };
  }

  const entries = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(entries)
    .digest("hex");

  if (expectedHash !== hash) {
    return {
      valid: false,
      reason: "hash_mismatch",
      authDate: Number.isFinite(authDate) ? authDate : null,
      queryId,
      session: buildSession({
        initDataPresent: true,
        startParam,
        user,
      }),
    };
  }

  if (!Number.isFinite(authDate)) {
    return {
      valid: false,
      reason: "invalid_auth_date",
      authDate: null,
      queryId,
      session: buildSession({
        initDataPresent: true,
        startParam,
        user,
      }),
    };
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - authDate);
  if (ageSeconds > maxAgeSeconds) {
    return {
      valid: false,
      reason: "auth_date_expired",
      authDate,
      queryId,
      session: buildSession({
        initDataPresent: true,
        startParam,
        user,
      }),
    };
  }

  return {
    valid: true,
    authDate,
    queryId,
    session: buildSession({
      verified: true,
      initDataPresent: true,
      startParam,
      user,
    }),
  };
}
