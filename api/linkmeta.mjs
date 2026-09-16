// Haalt een visuele preview op voor een link (Instagram/web) — voor het inspiratiebord.
// Geeft: og:image (cover), titel, og:video (mp4 indien aanwezig) en — voor Instagram-carrousels —
// de losse frames via ?img_index=1..N.
//
// Let op: de teruggegeven image-URL's van Instagram verlopen. Gebruik /api/inspthumb als
// je het beeld wilt bewaren.
import { haalMeta } from "../lib/linkbeeld.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const url = ((req.body && req.body.url) || "").toString().trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "geen geldige url" });
  try {
    return res.status(200).json(await haalMeta(url));
  } catch (e) {
    return res.status(200).json({ image: "", title: "", url, video: "", images: [] });
  }
}
