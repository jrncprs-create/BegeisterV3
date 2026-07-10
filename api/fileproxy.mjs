// Mini-proxy: haalt een Dropbox-bestand server-side op en serveert het INLINE
// (zodat de browser het toont i.p.v. downloadt; geen Google-viewer nodig).
export default async function handler(req, res) {
  try {
    const u = (req.query && req.query.u) || (req.body && req.body.u) || "";
    if (!u || !/dropbox/i.test(u)) return res.status(400).send("bad url");
    const r = await fetch(u, { redirect: "follow" });
    if (!r.ok) return res.status(502).send("upstream " + r.status);
    let ct = r.headers.get("content-type") || "application/octet-stream";
    // Dropbox levert .html vaak als octet-stream — dan rendert de browser niet, maar downloadt.
    // Op extensie dwingen we het juiste type af zodat een HTML-deck gewoon in de iframe verschijnt.
    if (/\.html?(\?|$)/i.test(u)) ct = "text/html; charset=utf-8";
    else if (/\.pdf(\?|$)/i.test(u)) ct = "application/pdf";
    else if (/\.svg(\?|$)/i.test(u)) ct = "image/svg+xml";
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).send("proxy error");
  }
}
