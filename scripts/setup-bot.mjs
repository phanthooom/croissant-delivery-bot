import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

async function callTelegram(method, token, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed.`);
  }

  return data.result;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const miniAppUrl =
    process.env.NEXT_PUBLIC_MINI_APP_URL ?? process.env.MINI_APP_URL;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Croissant";

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  }

  if (!miniAppUrl) {
    throw new Error(
      "NEXT_PUBLIC_MINI_APP_URL (or MINI_APP_URL) is missing for menu button setup.",
    );
  }

  const me = await callTelegram("getMe", token);
  const username = me.username ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  await callTelegram("setMyCommands", token, {
    commands: [
      { command: "start", description: "Открыть Mini App" },
      { command: "help", description: "Показать инструкции" },
    ],
  });

  await callTelegram("setMyShortDescription", token, {
    short_description:
      "Каталог и оформление заказов прямо внутри Telegram.",
  });

  await callTelegram("setMyDescription", token, {
    description: `${brandName}: Telegram Mini App для каталога, корзины и оформления заказов.`,
  });

  await callTelegram("setChatMenuButton", token, {
    menu_button: {
      type: "web_app",
      text: "Открыть Mini App",
      web_app: {
        url: miniAppUrl,
      },
    },
  });

  if (webhookUrl) {
    await callTelegram("setWebhook", token, {
      url: webhookUrl,
      allowed_updates: ["message"],
      ...(webhookSecret ? { secret_token: webhookSecret } : {}),
    });
  }

  console.log("Telegram bot configured successfully.");
  console.log(`Bot: @${username}`);
  console.log(`Mini App URL: ${miniAppUrl}`);
  if (webhookUrl) {
    console.log(`Webhook: ${webhookUrl}`);
  } else {
    console.log("Webhook: skipped");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
