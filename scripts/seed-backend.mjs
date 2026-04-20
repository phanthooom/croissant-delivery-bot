import nextEnv from "@next/env";
import vm from "node:vm";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE_URL = process.env.BACKEND_API_BASE_URL;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const CATALOG_URL = process.env.CATALOG_SOURCE_URL ?? "https://croissant.delever.uz/ru";
const LOCALE = process.env.CATALOG_LOCALE ?? "ru";

if (!BASE_URL) throw new Error("BACKEND_API_BASE_URL is missing");
if (!ADMIN_CHAT_ID) throw new Error("TELEGRAM_ADMIN_CHAT_ID is missing");

// ── website scraper ──────────────────────────────────────────────────────────

function cleanText(v) { return v?.replace(/\s+/g, " ").trim() ?? ""; }

function pick(field, locale) {
  if (!field) return "";
  return cleanText(field[locale]) || cleanText(field.ru) || cleanText(field.uz) ||
    cleanText(field.en) || cleanText(Object.values(field).find(Boolean));
}

function cdnUrl(id) {
  if (!id) return null;
  if (id.startsWith("http://") || id.startsWith("https://")) return id;
  return `https://cdn.delever.uz/delever/${id}`;
}

function extractJsonArray(source, token) {
  const ti = source.indexOf(token);
  if (ti === -1) throw new Error("token not found: " + token);
  const start = source.indexOf("[", ti);
  if (start === -1) throw new Error("array start not found");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") { depth++; continue; }
    if (c === "]") { if (--depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error("array end not found");
}

async function fetchCatalog() {
  console.log("Fetching catalog from", CATALOG_URL);
  const res = await fetch(CATALOG_URL, { headers: { "User-Agent": "SeedScript/1.0" } });
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const html = await res.text();

  const scripts = [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).filter(s => s.includes("self.__next_f.push"));

  const pushes = [];
  const ctx = vm.createContext({
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    self: { __next_f: { push(v) { pushes.push(v); } } },
  });
  for (const s of scripts) { try { vm.runInContext(s, ctx); } catch {} }

  const strings = pushes.flatMap(e => Array.isArray(e) ? e.filter(v => typeof v === "string") : []);
  const payload = strings.find(s => s.includes('"data":{"categories":['));
  if (!payload) throw new Error("categories payload not found in HTML");

  const raw = JSON.parse(extractJsonArray(payload, '"data":{"categories":'));
  const result = [];
  for (const cat of raw) {
    if (!cat.active) continue;
    const products = (cat.products ?? []).filter(p => p.active && p.active_in_menu);
    if (!products.length) continue;
    result.push({ raw: cat, products });
  }
  console.log(`Parsed ${result.length} categories, ${result.reduce((s, c) => s + c.products.length, 0)} products`);
  return result;
}

// ── backend API ──────────────────────────────────────────────────────────────

async function apiPost(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function authenticate() {
  console.log("Authenticating as admin (telegram_id:", ADMIN_CHAT_ID, ")");
  const data = await apiPost("/auth/telegram", {
    telegram_id: Number(ADMIN_CHAT_ID),
    full_name: "Admin",
    username: "admin",
    language_code: "ru",
  });
  console.log("Got token:", data.access_token ? "✓" : "✗");
  return data.access_token;
}

// ── seed ─────────────────────────────────────────────────────────────────────

async function main() {
  const catalog = await fetchCatalog();
  const token = await authenticate();

  let catCreated = 0, prodCreated = 0, prodSkipped = 0;

  for (let i = 0; i < catalog.length; i++) {
    const { raw: cat, products } = catalog[i];
    const catName = pick(cat.title, LOCALE) || (cat.slug ?? "Category");

    let backendCat;
    try {
      backendCat = await apiPost("/categories", {
        name: catName,
        name_ru: pick(cat.title, "ru") || undefined,
        name_uz: pick(cat.title, "uz") || undefined,
        sort_order: i,
      }, token);
      catCreated++;
      console.log(`  Category [${i + 1}/${catalog.length}]: ${catName} → ${backendCat.id}`);
    } catch (err) {
      console.error(`  Category "${catName}" failed:`, err.message);
      continue;
    }

    for (const p of products) {
      const name = pick(p.title, LOCALE) || p.slug || "Product";
      const price = p.out_price ?? 0;
      if (price <= 0) { prodSkipped++; continue; }
      try {
        await apiPost("/products", {
          name,
          name_ru: pick(p.title, "ru") || undefined,
          name_uz: pick(p.title, "uz") || undefined,
          description_ru: pick(p.description, "ru") || undefined,
          description_uz: pick(p.description, "uz") || undefined,
          price,
          image_url: cdnUrl(p.image) || undefined,
          category_id: backendCat.id,
          is_active: true,
        }, token);
        prodCreated++;
        process.stdout.write(".");
      } catch {
        prodSkipped++;
        process.stdout.write("x");
      }
    }
    console.log();
  }

  console.log(`\nDone: ${catCreated} categories, ${prodCreated} products created, ${prodSkipped} skipped.`);
}

main().catch(err => { console.error(err.message); process.exitCode = 1; });
