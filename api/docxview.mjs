// Zet een Word-document om naar eenvoudige HTML, zodat de app het kan tonen.
// Een browser kan .docx niet renderen; mammoth haalt de tekst en de structuur eruit.
//
// De client stuurt een URL die hij zelf al mag ophalen (signed URL uit Supabase Storage,
// of de fileproxy voor Dropbox). We halen 'm hier op en geven HTML terug.
import mammoth from "mammoth";

const MAX = 20 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const { url, name = "" } = req.body || {};
    if (!url || !/^https?:\/\//i.test(String(url)) && !String(url).startsWith("/api/")) {
      return res.status(400).json({ error: "geen geldige url" });
    }

    // Relatieve proxy-url's (Dropbox) op onszelf oplossen.
    const vol = String(url).startsWith("/api/")
      ? `http://127.0.0.1:${process.env.PORT || 8080}${url}`
      : url;

    const r = await fetch(vol, { redirect: "follow" });
    if (!r.ok) return res.status(200).json({ error: "kon het document niet ophalen (" + r.status + ")" });

    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) return res.status(200).json({ error: "document te groot om te tonen" });

    const out = await mammoth.convertToHtml({ buffer: buf });
    const html = (out && out.value) || "";
    if (!html.trim()) return res.status(200).json({ error: "dit Word-document bevat geen leesbare inhoud" });

    return res.status(200).json({ html, naam: name, waarschuwingen: (out.messages || []).length });
  } catch (e) {
    console.error("docxview", e && e.message);
    return res.status(200).json({ error: "kon dit Word-document niet omzetten" });
  }
}
