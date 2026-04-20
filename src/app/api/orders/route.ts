import {
  adaptBackendOrderToReceipt,
  BackendApiError,
  createBackendOrder,
  syncBackendCart,
  updateBackendProfile,
} from "@/lib/backend-api";
import { normalizeLocale, pickLocalizedText, getTranslations } from "@/lib/i18n";
import { mirrorBackendOrderToTelegram } from "@/lib/backend-order-mirror";
import { getBackendAccessTokenFromCookies } from "@/lib/backend-session";
import { OrderSubmissionError, submitOrder } from "@/lib/order-service";
import { getServerCapabilities } from "@/lib/server-config";
import { validateTelegramInitData } from "@/lib/telegram-auth";
import type { OrderFormInput, TelegramMiniAppUser } from "@/lib/types";

export const runtime = "nodejs";

function normalizeTelegramUser(payload: OrderFormInput): TelegramMiniAppUser | null {
  return payload.previewUser?.id ? payload.previewUser : null;
}

export async function POST(request: Request) {
  let payload: OrderFormInput | null = null;

  try {
    payload = (await request.json()) as OrderFormInput;
    const requestPayload = payload;
    const capabilities = getServerCapabilities();
    const backendToken = await getBackendAccessTokenFromCookies();
    let syncedCart = null;

    if (capabilities.hasBackendApi && backendToken && requestPayload.useBackendOrder !== false) {
      if (requestPayload.customerName.trim() || requestPayload.phone.trim()) {
        await updateBackendProfile(backendToken, {
          fullName: requestPayload.customerName,
          phone: requestPayload.phone,
          languageCode: requestPayload.previewUser?.languageCode,
        });
      }

      if (requestPayload.items.length > 0) {
        syncedCart = await syncBackendCart(backendToken, requestPayload.items);
      }

      const telegramUser =
        requestPayload.initData && capabilities.canValidateTelegramSession
          ? validateTelegramInitData(
              requestPayload.initData,
              process.env.TELEGRAM_BOT_TOKEN ?? "",
              Number(process.env.TELEGRAM_AUTH_MAX_AGE ?? 86400),
            ).session.user
          : normalizeTelegramUser(requestPayload);

      const order = await createBackendOrder(backendToken, requestPayload);
      const receipt = adaptBackendOrderToReceipt(order, requestPayload, telegramUser);

      if (receipt.lines.length === 0 && syncedCart) {
        receipt.lines = syncedCart.items.map((item) => ({
          productId: item.product_id,
          title: pickLocalizedText(
            normalizeLocale(requestPayload.locale),
            {
              ru: item.product.name_ru,
              uz: item.product.name_uz,
              en: item.product.name_en,
            },
            [item.product.name],
          ),
          quantity: item.quantity,
          unitPrice: Number(item.product.price),
          lineTotal: Number(item.subtotal),
          categoryTitle:
            pickLocalizedText(
              normalizeLocale(requestPayload.locale),
              {
                ru: item.product.category?.name_ru,
                uz: item.product.category?.name_uz,
                en: item.product.category?.name_en,
              },
              [item.product.category?.name],
            ) || "",
        }));
      }

      try {
        await mirrorBackendOrderToTelegram(receipt);
      } catch (error) {
        console.warn("Backend order was created but Telegram mirroring failed.", error);
      }

      return Response.json({
        ok: true,
        receipt,
      });
    }

    const receipt = await submitOrder(requestPayload);

    return Response.json({
      ok: true,
      receipt,
    });
  } catch (error) {
    if (error instanceof OrderSubmissionError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    if (error instanceof BackendApiError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }

    return Response.json(
      {
        ok: false,
        error: getTranslations(
          normalizeLocale(payload?.locale),
        ).validation.backendOrderFailed,
      },
      { status: 500 },
    );
  }
}
