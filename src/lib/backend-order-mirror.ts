import "server-only";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  getTranslations,
  normalizeLocale,
  translatePaymentMethod,
} from "@/lib/i18n";
import { getServerCapabilities, getServerConfig } from "@/lib/server-config";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import type { OrderReceipt } from "@/lib/types";

function buildAdminMessage(receipt: OrderReceipt, brandName: string) {
  const locale = normalizeLocale(receipt.locale);
  const t = getTranslations(locale);
  const user = receipt.telegramUser;
  const userLabel = user
    ? `${user.firstName}${user.username ? ` (@${user.username})` : ""} | ID ${user.id}`
    : t.bot.adminOrderMessage.unverifiedUser;

  return [
    t.bot.adminOrderMessage.title(brandName, receipt.orderId),
    "",
    `${t.bot.adminOrderMessage.customer}: ${receipt.customerName}`,
    `${t.bot.adminOrderMessage.phone}: ${receipt.phone}`,
    `${t.bot.adminOrderMessage.address}: ${receipt.address}`,
    `${t.bot.adminOrderMessage.payment}: ${translatePaymentMethod(locale, receipt.paymentMethod)}`,
    `${t.bot.adminOrderMessage.deliveryTime}: ${receipt.deliveryTime || t.delivery.asap}`,
    `${t.bot.adminOrderMessage.telegram}: ${userLabel}`,
    `${t.bot.adminOrderMessage.startParam}: ${receipt.startParam ?? "-"}`,
    `${t.bot.adminOrderMessage.created}: ${formatDateTime(receipt.createdAt, locale)}`,
    "",
    `${t.bot.adminOrderMessage.items}:`,
    ...receipt.lines.map(
      (line, index) =>
        `${index + 1}. ${line.title} x${line.quantity} - ${formatPrice(line.lineTotal, receipt.currency, locale)}`,
    ),
    "",
    `${t.bot.adminOrderMessage.total}: ${formatPrice(receipt.total, receipt.currency, locale)}`,
    `${t.bot.adminOrderMessage.comment}: ${receipt.comment || "-"}`,
  ].join("\n");
}

function buildCustomerMessage(receipt: OrderReceipt, brandName: string) {
  const locale = normalizeLocale(receipt.locale);
  const t = getTranslations(locale);

  const lines = receipt.lines
    .map((line) => `  • ${line.title} ×${line.quantity}`)
    .join("\n");

  return [
    `🎉 <b>${t.bot.customerOrderMessage.title(brandName)}</b>`,
    "",
    `🧾 <b>${t.bot.customerOrderMessage.order}:</b> <code>${receipt.orderId}</code>`,
    lines ? `\n${lines}\n` : "",
    `💰 <b>${t.bot.customerOrderMessage.total}:</b> ${formatPrice(receipt.total, receipt.currency, locale)}`,
    `📍 <b>${t.bot.customerOrderMessage.address}:</b> ${receipt.address}`,
    `🕐 <b>${t.bot.customerOrderMessage.deliveryTime}:</b> ${receipt.deliveryTime || t.delivery.asap}`,
    "",
    `💬 ${t.bot.customerOrderMessage.footer}`,
  ].join("\n");
}

export async function mirrorBackendOrderToTelegram(receipt: OrderReceipt) {
  const capabilities = getServerCapabilities();
  const config = getServerConfig();

  if (!capabilities.canSendOrdersToTelegram) {
    return;
  }

  await sendTelegramMessage(
    config.adminChatId,
    buildAdminMessage(receipt, config.brandName),
  );

  if (config.botToken && receipt.telegramUser?.id) {
    try {
      await sendTelegramMessage(
        receipt.telegramUser.id,
        buildCustomerMessage(receipt, config.brandName),
        { parse_mode: "HTML" },
      );
    } catch {
      // Keep the order successful even if the confirmation DM is blocked.
    }
  }
}
