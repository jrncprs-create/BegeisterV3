// Intake-endpoint. Wordt frequent aangeroepen door een externe cron
// (cron-job.org, ~elke 2 min) en daarnaast 1x/dag door de Vercel-cron als
// vangnet (zie vercel.json). Beveiligd met CRON_SECRET in de Authorization-header.
import { run } from "../intake/poller.mjs";
import { verifyChallenge, handleEvent } from "../intake/whatsapp.mjs";
import { handleInstaEvent } from "../intake/instagram.mjs";

export default async function handler(req, res) {
  // --- WhatsApp Cloud API webhook ---
  // GET-handshake (Meta verifieert de Callback-URL)
  if (req.method === "GET" && req.query && req.query["hub.mode"]) {
    const challenge = verifyChallenge(req.query);
    if (challenge !== null) return res.status(200).send(challenge);
    return res.status(403).send("forbidden");
  }
  // POST-events (inkomende WhatsApp-berichten).
  // Direct 200 teruggeven (Meta heeft een korte timeout en herprobeert anders → dubbele items),
  // de AI-verwerking draait daarna op de achtergrond.
  if (req.method === "POST" && req.body && req.body.object === "whatsapp_business_account") {
    res.status(200).json({ ok: true });
    Promise.resolve(handleEvent(req.body)).catch(e => console.error("whatsapp:", e.message));
    return;
  }
  // --- Instagram-berichten webhook (gedeelde posts → Inspiratie) ---
  if (req.method === "POST" && req.body && req.body.object === "instagram") {
    res.status(200).json({ ok: true });
    Promise.resolve(handleInstaEvent(req.body)).catch(e => console.error("instagram:", e.message));
    return;
  }

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
