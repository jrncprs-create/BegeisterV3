// Leest de og:-tags van een pagina en — belangrijker — bewaart het gevonden beeld.
//
// Waarom bewaren: Instagram serveert zijn afbeeldingen vanaf scontent-*.cdninstagram.com
// met een ondertekende URL die na een paar dagen verloopt. Wie die URL opslaat, heeft over
// een week een zwart vlak. We halen het plaatje daarom één keer op en zetten het in onze
// eigen Storage; daarna is de link naar Instagram alleen nog "waar het vandaan kwam".

import crypto from "crypto";

const UA = "Mozilla/5.0 (compatible; BegeisterBot/1.0)";
export const MAX_BEELD = 8 * 1024 * 1024;

export function decodeEnt(s) {
  return String(s || "")
    .replace(/&amp;/gi, "&").replace(/&#x2F;/gi, "/").replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ").trim();
}

export function pickMeta(html, props) {
  for (const p of props) {
    let m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\\\']' + p + '["\\\'][^>]*content=["\\\']([^"\\\']+)["\\\']', "i"));
    if (m && m[1]) return m[1];
    m = html.match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*(?:property|name)=["\\\']' + p + '["\\\']', "i"));
    if (m && m[1]) return m[1];
  }
  return "";
}

export function absUrl(v, base) {
  v = decodeEnt(v);
  if (v && v.indexOf("//") === 0) return "https:" + v;
  if (v && v.indexOf("/") === 0) { try { return new URL(base).origin + v; } catch (_) {} }
  return v;
}

export const pickImage = (html, base) => absUrl(pickMeta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]), base);
export const pickVideo = (html, base) => absUrl(pickMeta(html, ["og:video:secure_url", "og:video", "og:video:url", "twitter:player:stream"]), base);

export async function fetchHtml(u) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA } });
    return (await r.text()).slice(0, 600000);
  } finally { clearTimeout(t); }
}

/** og:image, titel, video en (bij een Instagram-carrousel) de losse frames. */
// Prijs uit de pagina raden: eerst nette meta-tags, anders de eerste €-prijs in de body.
function pickPrice(html) {
  const meta = pickMeta(html, ["product:price:amount", "og:price:amount", "twitter:data1"]);
  if (meta) { const m = String(meta).replace(",", ".").match(/\d+(?:\.\d{1,2})?/); if (m) return parseFloat(m[0]); }
  const im = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i);
  if (im) { const m = im[1].replace(".", "").replace(",", "."); const v = parseFloat(m); if (!isNaN(v)) return v; }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const em = body.match(/(?:€|EUR)\s*([0-9]{1,4}(?:[.,][0-9]{2}))/i);
  if (em) { const v = parseFloat(em[1].replace(".", "").replace(",", ".")); if (!isNaN(v) && v > 0) return v; }
  return null;
}
export async function haalMeta(url) {
  const html = await fetchHtml(url);
  const image = pickImage(html, url);
  const price = pickPrice(html);
  let title = pickMeta(html, ["og:title", "twitter:title"]) || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  title = decodeEnt(title);
  const video = pickVideo(html, url);
  let images = image ? [image] : [];

  if (/instagram\.com\/(p|tv)\//i.test(url)) {
    try {
      const seen = new Set(); images = [];
      for (let idx = 1; idx <= 10; idx++) {
        let u; try { u = new URL(url); } catch (_) { break; }
        u.searchParams.set("img_index", String(idx));
        const im = pickImage(await fetchHtml(u.toString()), url);
        if (!im || seen.has(im)) break;
        seen.add(im); images.push(im);
      }
      if (!images.length && image) images = [image];
    } catch (_) { if (image) images = [image]; }
  }
  return { image: images[0] || image || "", title, url, video: video || "", images, price };
}

const EXT_VAN_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

/**
 * Haalt één afbeelding op en zet 'm in Storage. Idempotent: dezelfde bron-URL levert
 * hetzelfde pad, dus opnieuw draaien maakt geen duplicaten.
 * @returns {Promise<string|null>} storage_path, of null als het niet lukte
 */
export async function bewaarBeeld(db, imgUrl, bucket = "intake", map = "insp") {
  if (!/^https?:\/\//i.test(String(imgUrl || ""))) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(imgUrl, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const mime = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX_BEELD) return null;

    const hash = crypto.createHash("sha1").update(imgUrl).digest("hex").slice(0, 24);
    const path = `${map}/${hash}.${EXT_VAN_MIME[mime] || "jpg"}`;
    const up = await db.storage.from(bucket).upload(path, buf, { contentType: mime, upsert: true });
    if (up.error) return null;
    return path;
  } catch (_) {
    return null;
  } finally { clearTimeout(t); }
}
