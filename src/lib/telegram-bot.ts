import "server-only";
import { getServerConfig } from "@/lib/server-config";

type JsonRecord = Record<string, unknown>;

async function callTelegramApi<T>(
  method: string,
  payload: JsonRecord = {},
): Promise<T> {
  const config = getServerConfig();

  if (!config.botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${config.botToken}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  if (!response.ok || !data.ok || data.result === undefined) {
    throw new Error(
      data.description ||
        `Telegram API ${method} failed with status ${response.status}.`,
    );
  }

  return data.result;
}

export function buildMiniAppInlineKeyboard(url: string, text: string) {
  return {
    inline_keyboard: [
      [
        {
          text,
          web_app: {
            url,
          },
        },
      ],
    ],
  };
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  extra: JsonRecord = {},
) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

export async function setupTelegramBot() {
  const config = getServerConfig();
  const me = await callTelegramApi<{ username?: string }>("getMe");
  const username = me.username ?? config.botUsername;

  await callTelegramApi("setMyCommands", {
    commands: [
      {
        command: "start",
        description: "Открыть Mini App",
      },
      {
        command: "help",
        description: "Показать быстрые инструкции",
      },
    ],
  });

  await callTelegramApi("setMyShortDescription", {
    short_description:
      "Croissant Mini App: каталог, корзина и быстрый заказ из Telegram.",
  });

  await callTelegramApi("setMyDescription", {
    description:
      "Telegram Mini App для Croissant: живой каталог, оформление заказа и удобный запуск из меню бота.",
  });

  await callTelegramApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Открыть Mini App",
      web_app: {
        url: config.miniAppUrl,
      },
    },
  });

  if (config.webhookUrl) {
    await callTelegramApi("setWebhook", {
      url: config.webhookUrl,
      allowed_updates: ["message"],
      ...(config.webhookSecret
        ? { secret_token: config.webhookSecret }
        : {}),
    });
  }

  return {
    username,
    miniAppUrl: config.miniAppUrl,
    webhookConfigured: Boolean(config.webhookUrl),
  };
}
