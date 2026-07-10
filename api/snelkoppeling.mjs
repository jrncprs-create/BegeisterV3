// Leest de URL uit een snelkoppeling (.webloc, .url) zodat de app er een klikbare link
// van kan maken in plaats van een leeg voorvertoningskader.
//
// De client stuurt een URL die hij zelf al mag ophalen (signed URL uit Supabase Storage,
// of de fileproxy voor Dropbox). Wij halen het bestandje op en vissen de link eruit.
import { snelkoppelingUrl } from "../lib/extractdoc.mjs";

const MAX = 256 * 1024;   // een snelkoppeling is een paar honderd bytes

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { url, name = "" } = req.body || {};
    if (!url || (!/^https?:\/\//i.test(String(url)) && !String(url).startsWith("/api/"))) {
      return res.status(400).json({ error: "geen geldige url" });
    }
    const vol = String(url).startsWith("/api/")
      ? `http://127.0.0.1:${process.env.PORT || 8080}${url}`
      : url;

    const r = await fetch(vol, { redirect: "follow" });
    if (!r.ok) return res.status(200).json({ error: "kon de snelkoppeling niet ophalen (" + r.status + ")" });

    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) return res.status(200).json({ error: "dit is geen snelkoppeling" });

    const doel = snelkoppelingUrl(buf);
    if (!doel) return res.status(200).json({ error: "geen link gevonden in deze snelkoppeling" });

    return res.status(200).json({ url: doel, naam: name });
  } catch (e) {
    console.error("snelkoppeling", e && e.message);
    return res.status(200).json({ error: "kon deze snelkoppeling niet lezen" });
  }
}
