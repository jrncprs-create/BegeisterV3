// Gedeelde inspiratie-backend: bepaalt met AI een THEMA en zet beeld/link op het juiste board.
// Wordt gebruikt door de Instagram-webhook (en later de WhatsApp-route).
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = KEY ? new Anthropic({ apiKey: KEY }) : null;
const VISION = "claude-sonnet-4-6";
const FAST = "claude-haiku-4-5-20251001";
const BUCKET = "intake";

export function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function cleanTheme(s) { return String(s || "").replace(/^[\s"'`]+/, "").replace(/[\s"'`.]+$/, "").split("\n")[0].slice(0, 40).trim(); }
function decodeEnt(s) { return String(s || "").replace(/&amp;/gi, "&").replace(/&#x2F;/gi, "/").replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ").trim(); }
function pickMeta(html, props) {
  for (const p of props) {
    let m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\\\']' + p + '["\\\'][^>]*content=["\\\']([^"\\\']+)["\\\']', "i"));
    if (m && m[1]) return m[1];
    m = html.match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*(?:property|name)=["\\\']' + p + '["\\\']', "i"));
    if (m && m[1]) return m[1];
  }
  return "";
}
export async function fetchOg(url) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; BegeisterBot/1.0)" } });
    clearTimeout(t);
    const html = (await r.text()).slice(0, 500000);
    let image = pickMeta(html, ["og:image:secure_url", "og:image", "twitter:image"]);
    let title = pickMeta(html, ["og:title", "twitter:title"]) || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    image = decodeEnt(image); title = decodeEnt(title);
    if (image && image.indexOf("//") === 0) image = "https:" + image;
    return { image, title };
  } catch (_) { return { image: "", title: "" }; }
}

async function loadThemes(db) { try { const { data } = await db.from("insp_boards").select("id,name"); return data || []; } catch (_) { return []; } }
async function ensureBoard(db, name) {
  name = cleanTheme(name) || "Inspiratie";
  const themes = await loadThemes(db);
  const hit = themes.find(t => (t.name || "").toLowerCase() === name.toLowerCase());
  if (hit) return hit.id;
  try { const r = await db.from("insp_boards").insert({ name, sort: themes.length }).select("id").single(); return r && r.data ? r.data.id : null; } catch (_) { return null; }
}
async function aiThemeText(db, hint) {
  if (!anthropic) return "Inspiratie";
  const themes = (await loadThemes(db)).map(t => t.name).filter(Boolean);
  const sys = `Je beheert een visueel inspiratiebord voor Begeister (licht, decor, events). Kies het best passende THEMA voor dit item. Past een bestaand thema? Gebruik dat exact. Anders verzin een NIEUW kort thema (1-3 woorden, Nederlands, hoofdletter aan het begin). Antwoord ALLEEN met de themanaam.`;
  const user = `ITEM: ${hint}\n\nBESTAANDE THEMA'S:\n${themes.length ? themes.map(t => "- " + t).join("\n") : "(nog geen)"}`;
  try { const r = await anthropic.messages.create({ model: FAST, max_tokens: 24, system: sys, messages: [{ role: "user", content: user }] }); return cleanTheme(r.content.map(b => b.type === "text" ? b.text : "").join("")) || "Inspiratie"; } catch (_) { return "Inspiratie"; }
}
async function aiThemeImage(db, b64, mime) {
  if (!anthropic) return "Inspiratie";
  const themes = (await loadThemes(db)).map(t => t.name).filter(Boolean);
  const sys = `Je beheert een visueel inspiratiebord voor Begeister (licht, decor, events). Bekijk de afbeelding en kies het best passende THEMA. Past een bestaand thema? Gebruik dat exact. Anders een NIEUW kort thema (1-3 woorden, Nederlands, hoofdletter). Antwoord ALLEEN met de themanaam.`;
  try {
    const r = await anthropic.messages.create({ model: VISION, max_tokens: 24, system: sys, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } }, { type: "text", text: `Bestaande thema's:\n${themes.length ? themes.map(t => "- " + t).join("\n") : "(geen)"}` }] }] });
    return cleanTheme(r.content.map(b => b.type === "text" ? b.text : "").join("")) || "Inspiratie";
  } catch (_) { return "Inspiratie"; }
}

// Een afbeelding-buffer (bv. een via WhatsApp doorgestuurde foto): AI bepaalt thema, opslaan op board.
export async function addInspirationImageBuffer(db, { buf, mime, title, fallbackThumb }) {
  try {
    const b64 = Buffer.from(buf).toString("base64");
    const m = (mime || "image/jpeg").split(";")[0];
    const theme = await aiThemeImage(db, b64, m);
    const boardId = await ensureBoard(db, theme);
    const ext = m.indexOf("png") >= 0 ? "png" : (m.indexOf("webp") >= 0 ? "webp" : "jpg");
    const path = "inspiratie/" + (boardId || "los") + "/wa-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
    const up = await db.storage.from(BUCKET).upload(path, Buffer.from(b64, "base64"), { contentType: m, upsert: true });
    const row = { board_id: boardId, type: "image", title: title || "", sort: 0 };
    if (!up.error) row.storage_path = path; else if (fallbackThumb) row.thumb = fallbackThumb;
    await db.from("insp_items").insert(row);
    return { ok: true, theme };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
// Een afbeelding via URL ophalen (gedeelde Instagram-post e.d.), AI laat thema bepalen, opslaan op het board.
export async function addInspirationImageUrl(db, { url, title }) {
  try {
    const buf = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (BegeisterBot/1.0)" } }).then(r => r.arrayBuffer());
    return await addInspirationImageBuffer(db, { buf: Buffer.from(buf), mime: "image/jpeg", title, fallbackThumb: url });
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
// Een link (Instagram/web): og:image ophalen, AI laat thema bepalen, als linktegel opslaan.
export async function addInspirationLink(db, { url }) {
  try {
    const meta = await fetchOg(url);
    const theme = await aiThemeText(db, ((meta.title || "") + " " + url).trim());
    const boardId = await ensureBoard(db, theme);
    await db.from("insp_items").insert({ board_id: boardId, type: "link", url, thumb: meta.image || "", title: meta.title || url, sort: 0 });
    return { ok: true, theme };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
