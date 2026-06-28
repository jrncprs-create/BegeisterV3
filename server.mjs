// Begeister — één Node-server voor de VPS.
// Serveert de statische app (public/) + alle /api-routes (de bestaande Vercel-handlers)
// + draait de intake-poller zelf op een interne timer (geen externe cron meer nodig).
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { run as intakeRun } from "./intake/poller.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Vercel-stijl handler (export default (req,res)) mounten op een route.
async function mount(route, modPath) {
  try {
    const mod = await import(modPath);
    const handler = mod.default;
    app.all(route, (req, res) => Promise.resolve(handler(req, res)).catch(e => {
      console.error("route-fout", route, e && e.message);
      if (!res.headersSent) res.status(500).json({ error: "server" });
    }));
    console.log("mounted", route);
  } catch (e) {
    console.error("kon route niet laden", route, e && e.message);
  }
}

await mount("/api/intake", "./api/intake.mjs");
await mount("/api/opdracht", "./api/opdracht.mjs");
await mount("/api/readdrop", "./api/readdrop.mjs");
await mount("/api/chat", "./api/chat.mjs");
await mount("/api/vision", "./api/vision.mjs");
await mount("/api/readfile", "./api/readfile.mjs");
await mount("/api/usage", "./api/usage.mjs");
await mount("/api/spark", "./api/spark.mjs");
await mount("/api/sortfiles", "./api/sortfiles.mjs");
await mount("/api/fileproxy", "./api/fileproxy.mjs");
await mount("/api/notify", "./api/notify.mjs");
await mount("/api/push", "./api/push.mjs");
await mount("/api/backfill-contacts", "./api/backfill-contacts.mjs");
await mount("/api/dropbox/connect", "./api/dropbox/connect.mjs");
await mount("/api/dropbox/callback", "./api/dropbox/callback.mjs");
await mount("/api/dropbox/list", "./api/dropbox/list.mjs");

// Statische app
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Alles wat geen /api is en geen bestaand bestand → de app (index.html)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not found" });
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Interne intake-cron: elke 2 minuten de mailbox verwerken.
cron.schedule("*/2 * * * *", () => {
  intakeRun().then(r => { if (r && (r.processed || r.items)) console.log("intake", r); })
             .catch(e => console.error("cron intake", e && e.message));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Begeister draait op poort " + PORT));
