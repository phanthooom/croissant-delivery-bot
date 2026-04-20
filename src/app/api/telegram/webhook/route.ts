import { getServerConfig } from "@/lib/server-config";
import { getTranslations, normalizeLocale } from "@/lib/i18n";
import {
  buildMiniAppInlineKeyboard,
  sendTelegramMessage,
} from "@/lib/telegram-bot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getServerConfig();

  if (config.webhookSecret) {
    const incomingSecret = request.headers.get(
      "x-telegram-bot-api-secret-token",
    );

    if (incomingSecret !== config.webhookSecret) {
      return Response.json({ ok: false }, { status: 401 });
    }
  }

  const update = (await request.json()) as {
    message?: {
      chat?: { id?: number };
      from?: { language_code?: string };
      text?: string;
      web_app_data?: { data?: string };
    };
  };

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? "";
  const locale = normalizeLocale(update.message?.from?.language_code);
  const t = getTranslations(locale);

  if (!chatId) {
    return Response.json({ ok: true });
  }

  if (text.startsWith("/start")) {
    await sendTelegramMessage(chatId, t.bot.startMessage(config.brandName), {
      reply_markup: buildMiniAppInlineKeyboard(
        config.miniAppUrl,
        t.bot.openMiniApp,
      ),
    });
  } else if (text.startsWith("/help")) {
    await sendTelegramMessage(chatId, t.bot.helpMessage, {
      reply_markup: buildMiniAppInlineKeyboard(
        config.miniAppUrl,
        t.bot.openMiniApp,
      ),
    });
  } else if (update.message?.web_app_data?.data) {
    await sendTelegramMessage(
      chatId,
      t.bot.webAppDataReceived,
    );
  }

  return Response.json({ ok: true });
}
