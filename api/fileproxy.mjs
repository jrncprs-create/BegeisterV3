// Mini-proxy: haalt een Dropbox-bestand server-side op en serveert het INLINE
// (zodat de browser het toont i.p.v. downloadt; geen Google-viewer nodig).
export default async function handler(req, res) {
  try {
    const u = (req.query && req.query.u) || (req.body && req.body.u) || "";
    if (!u || !/dropbox/i.test(u)) return res.status(400).send("bad url");
    const r = await fetch(u, { redirect: "follow" });
    if (!r.ok) return res.status(502).send("upstream " + r.status);
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).send("proxy error");
  }
}
