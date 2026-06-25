// Vercel cron-endpoint. Wordt elke 5 min aangeroepen (zie vercel.json).
// Beveiligd met CRON_SECRET zodat alleen Vercel 'm kan triggeren.
import { run } from "../intake/poller.mjs";

export default async function handler(req, res) {
  const auth = req.headers["authorization"];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const result = await run();
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: String(e.message || e),
      name: e.name,
      code: e.code,
      authFailed: e.authenticationFailed,
      response: e.responseText || e.serverResponseCode || null,
      stack: (e.stack || "").split("\n").slice(0, 4),
    });
  }
}
