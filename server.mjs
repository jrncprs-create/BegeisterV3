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
await mount("/api/snelkoppeling", "./api/snelkoppeling.mjs");
await mount("/api/weer", "./api/weer.mjs");
await mount("/api/fileproxy", "./api/fileproxy.mjs");
await mount("/api/notify", "./api/notify.mjs");
await mount("/api/reply", "./api/reply.mjs");
await mount("/api/push", "./api/push.mjs");
await mount("/api/backfill-contacts", "./api/backfill-contacts.mjs");
await mount("/api/briefing", "./api/briefing.mjs");
await mount("/api/opschonen", "./api/opschonen.mjs");
await mount("/api/portal", "./api/portal.mjs");
await mount("/api/portalbeheer", "./api/portalbeheer.mjs");
await mount("/api/deploy", "./api/deploy.mjs");
await mount("/api/dropbox/connect", "./api/dropbox/connect.mjs");
await mount("/api/dropbox/callback", "./api/dropbox/callback.mjs");
await mount("/api/dropbox/list", "./api/dropbox/list.mjs");

// Statische app
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Het klantportaal is een eigen pagina, geen route in de teamapp.
app.get(["/portaal", "/portaal/*"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "portaal.html"));
});

// Alles wat geen /api is en geen bestaand bestand → de app.
// Op portal.begeister.nl is dat het klantportaal; elders de teamapp.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not found" });
  const host = String(req.headers.host || "").toLowerCase();
  if (host.startsWith("portal.")) return res.sendFile(path.join(__dirname, "public", "portaal.html"));
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

// U5 — Ochtendherinnering (07:30 NL-tijd): een push per persoon met wat er vandaag op het
// bord ligt (deadline vandaag/te laat + de handmatige "vandaag doen"-selectie). Taken zonder
// eigenaar tellen bij iedereen mee. Geen taken = geen melding (stilte is ook informatie).
cron.schedule("30 7 * * *", async () => {
  try {
    const { svc } = await import("./lib/usage.mjs");
    const { sendToWho } = await import("./lib/push.mjs");
    const db = svc();
    if (!db) return;
    const vandaag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }); // YYYY-MM-DD
    const { data: items } = await db.from("items")
      .select("title, owner, due, vandaag, status")
      .in("status", ["todo", "doing"])
      .is("archived_at", null)
      .or(`due.lte.${vandaag},vandaag.eq.${vandaag}`);
    const lijst = items || [];
    if (!lijst.length) return;
    for (const wie of ["Jeroen", "Marlon"]) {
      const mijn = lijst.filter(i => !i.owner || String(i.owner).toLowerCase().includes(wie.toLowerCase()));
      if (!mijn.length) continue;
      const teLaat = mijn.filter(i => i.due && i.due < vandaag).length;
      const titels = mijn.slice(0, 3).map(i => (i.title || "").slice(0, 40)).join(" · ");
      const body = (mijn.length + " taak" + (mijn.length === 1 ? "" : "en") + " voor vandaag"
        + (teLaat ? " (" + teLaat + " te laat)" : "") + ": " + titels).slice(0, 140);
      await sendToWho(db, { title: "Vandaag doen", body, url: "/" }, [wie]);
    }
  } catch (e) {
    console.error("cron dagherinnering", e && e.message);
  }
}, { timezone: "Europe/Amsterdam" });

// U17 — Wekelijkse gezondheidscheck (maandag 08:00 NL): duplicaten, wezen en rare
// financiële waardes → één taakkaart met checklist + push. Stil als er niets is.
cron.schedule("0 8 * * 1", async () => {
  try {
    const { svc } = await import("./lib/usage.mjs");
    const { draaiGezondheidscheck } = await import("./lib/gezondheid.mjs");
    const db = svc();
    if (!db) return;
    const r = await draaiGezondheidscheck(db);
    console.log("gezondheidscheck", r);
  } catch (e) {
    console.error("cron gezondheidscheck", e && e.message);
  }
}, { timezone: "Europe/Amsterdam" });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Begeister draait op poort " + PORT));
