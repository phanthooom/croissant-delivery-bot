import "server-only";
import crypto from "node:crypto";
import { getCatalog } from "@/lib/catalog";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  normalizeLocale,
  translatePaymentMethod,
  getTranslations,
} from "@/lib/i18n";
import { getServerCapabilities, getServerConfig } from "@/lib/server-config";
import { validateTelegramInitData } from "@/lib/telegram-auth";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import type {
  CatalogProduct,
  OrderFormInput,
  OrderLine,
  OrderReceipt,
  TelegramMiniAppUser,
} from "@/lib/types";

export class OrderSubmissionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function buildCatalogIndex(products: CatalogProduct[]) {
  return new Map(products.map((product) => [product.id, product]));
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function sanitizeCustomerName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeTelegramUser(user: TelegramMiniAppUser | null | undefined) {
  if (!user?.id || !user.firstName) {
    return null;
  }

  return {
    id: String(user.id),
    firstName: user.firstName.trim(),
    lastName: user.lastName?.trim(),
    username: user.username?.trim(),
    languageCode: user.languageCode?.trim(),
    isPremium: user.isPremium,
    photoUrl: user.photoUrl?.trim(),
    allowsWriteToPm: user.allowsWriteToPm,
  };
}

function buildLines(
  payload: OrderFormInput,
  productIndex: Map<string, CatalogProduct>,
  locale: ReturnType<typeof normalizeLocale>,
) {
  const t = getTranslations(locale);
  const lines: OrderLine[] = [];

  for (const item of payload.items) {
    const product = productIndex.get(item.productId);

    if (!product) {
      throw new OrderSubmissionError(
        t.validation.unavailableProduct,
      );
    }

    const quantity = Math.max(1, Math.min(20, Math.trunc(item.quantity)));
    if (!Number.isFinite(quantity)) {
      continue;
    }

    lines.push({
      productId: product.id,
      title: product.title,
      quantity,
      unitPrice: product.price,
      lineTotal: product.price * quantity,
      categoryTitle: product.categoryTitle,
    });
  }

  if (lines.length === 0) {
    throw new OrderSubmissionError(t.validation.addAtLeastOneProduct);
  }

  return lines;
}

function formatAdminMessage(receipt: OrderReceipt, brandName: string) {
  const locale = normalizeLocale(receipt.locale);
  const t = getTranslations(locale);
  const user = receipt.telegramUser;
  const userLabel = user
    ? `${user.firstName}${user.username ? ` (@${user.username})` : ""} • ID ${user.id}`
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
        `${index + 1}. ${line.title} x${line.quantity} — ${formatPrice(line.lineTotal, receipt.currency, locale)}`,
    ),
    "",
    `${t.bot.adminOrderMessage.total}: ${formatPrice(receipt.total, receipt.currency, locale)}`,
    `${t.bot.adminOrderMessage.comment}: ${receipt.comment || "-"}`,
  ].join("\n");
}

function formatCustomerMessage(receipt: OrderReceipt, brandName: string) {
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

export async function submitOrder(payload: OrderFormInput): Promise<OrderReceipt> {
  const locale = normalizeLocale(payload.locale ?? payload.previewUser?.languageCode);
  const t = getTranslations(locale);
  const customerName = sanitizeCustomerName(payload.customerName);
  const phone = normalizePhone(payload.phone);
  const address = payload.address.replace(/\s+/g, " ").trim();
  const comment = payload.comment.replace(/\s+/g, " ").trim();
  const deliveryTime = payload.deliveryTime.replace(/\s+/g, " ").trim();

  if (customerName.length < 2) {
    throw new OrderSubmissionError(t.validation.missingCustomerName);
  }

  if (phone.replace(/\D/g, "").length < 7) {
    throw new OrderSubmissionError(t.validation.invalidPhone);
  }

  if (address.length < 5) {
    throw new OrderSubmissionError(t.validation.missingAddress);
  }

  if (payload.deliveryMode !== "delivery") {
    throw new OrderSubmissionError(t.validation.deliveryOnly);
  }

  if (!["cash", "click", "payme"].includes(payload.paymentMethod)) {
    throw new OrderSubmissionError(t.validation.choosePayment);
  }

  const catalog = await getCatalog(locale);
  const productIndex = buildCatalogIndex(
    catalog.categories.flatMap((category) => category.products),
  );
  const lines = buildLines(payload, productIndex, locale);
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  const config = getServerConfig();
  const capabilities = getServerCapabilities();
  const telegramValidation = payload.initData
    ? validateTelegramInitData(
        payload.initData,
        config.botToken,
        config.authMaxAgeSeconds,
      )
    : null;

  if (payload.initData && config.botToken && !telegramValidation?.valid) {
    throw new OrderSubmissionError(
      t.validation.invalidTelegramSession,
      401,
    );
  }

  const telegramUser =
    telegramValidation?.session.user ??
    sanitizeTelegramUser(payload.previewUser) ??
    null;

  const receipt: OrderReceipt = {
    orderId: `CR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    total,
    currency: lines[0]?.unitPrice
      ? catalog.categories[0]?.products[0]?.currency ?? "UZS"
      : "UZS",
    locale,
    customerName,
    phone,
    address,
    comment,
    paymentMethod: payload.paymentMethod,
    deliveryMode: "delivery",
    deliveryTime: deliveryTime || t.delivery.asap,
    createdAt: new Date().toISOString(),
    lines,
    source: capabilities.canSendOrdersToTelegram ? "telegram-chat" : "preview",
    telegramUser,
    startParam:
      telegramValidation?.session.startParam ?? payload.startParam ?? null,
  };

  if (!capabilities.canSendOrdersToTelegram) {
    return receipt;
  }

  await sendTelegramMessage(
    config.adminChatId,
    formatAdminMessage(receipt, config.brandName),
  );

  if (config.botToken && telegramUser?.id) {
    try {
      await sendTelegramMessage(
        telegramUser.id,
        formatCustomerMessage(receipt, config.brandName),
        { parse_mode: "HTML" },
      );
    } catch {
      // Keep order delivery resilient even if confirmation DM fails.
    }
  }

  return receipt;
}
