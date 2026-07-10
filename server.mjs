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
// iOS-Opdracht mag een foto óók als ruw bestand sturen (Get Contents of URL → Verzoektekst: Bestand).
// Dan komt de afbeelding als binaire body binnen i.p.v. base64-in-JSON.
app.use("/api/opdracht", express.raw({
  type: req => {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    return ct.startsWith("image/") || ct === "application/pdf" || ct === "application/octet-stream";
  },
  limit: "25mb",
}));
await mount("/api/opdracht", "./api/opdracht.mjs");
await mount("/api/readdrop", "./api/readdrop.mjs");
await mount("/api/transcribe", "./api/transcribe.mjs");
await mount("/api/scanbudget", "./api/scanbudget.mjs");
await mount("/api/wa-subscribe", "./api/wa-subscribe.mjs");
await mount("/api/projtodos", "./api/projtodos.mjs");
await mount("/api/linkmeta", "./api/linkmeta.mjs");
await mount("/api/inspthumb", "./api/inspthumb.mjs");
await mount("/api/dropboxsync", "./api/dropboxsync.mjs");
await mount("/api/bestellijst", "./api/bestellijst.mjs");
await mount("/api/chat", "./api/chat.mjs");
await mount("/api/vision", "./api/vision.mjs");
await mount("/api/readfile", "./api/readfile.mjs");
await mount("/api/usage", "./api/usage.mjs");
await mount("/api/spark", "./api/spark.mjs");
await mount("/api/sortfiles", "./api/sortfiles.mjs");
await mount("/api/triage", "./api/triage.mjs");
await mount("/api/docxview", "./api/docxview.mjs");
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

// Dropbox-sync: elk uur. Kleine bijlagen gingen al direct mee bij binnenkomst;
// hier zetten we de grote in de wachtrij en werken we er een paar af.
// Bewust een kleine portie: één upload van 6 MB duurt tientallen seconden.
cron.schedule("7 * * * *", async () => {
  try {
    const { svc } = await import("./lib/usage.mjs");
    const { vulWachtrij, werkWachtrijAf } = await import("./lib/dropboxsync.mjs");
    const db = svc();
    if (!db) return;

    const bij = await vulWachtrij(db);
    if (bij) console.log(`dropbox-wachtrij: ${bij} bestand(en) toegevoegd`);

    // De echte upload loopt via de bestaande /api/dropbox/list-route, zodat de
    // token-verversing en de mappenstructuur op één plek blijven.
    const uploader = async ({ buffer, filename, doel }) => {
      const r = await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/dropbox/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload", name: filename, b64: buffer.toString("base64"),
          target: doel.replace(/^\//, ""), owner_type: "project",
        }),
      }).then(x => x.json());
      if (r && r.error) throw new Error(String(r.error));
      return { link: r && r.file ? r.file.link : null };
    };

    const uit = await werkWachtrijAf(db, uploader);
    if (uit.gedaan || uit.mislukt) console.log("dropbox-wachtrij", uit);
  } catch (e) {
    console.error("cron dropbox", e && e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Begeister draait op poort " + PORT));
