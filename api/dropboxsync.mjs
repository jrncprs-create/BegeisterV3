// De Dropbox-wachtrij met de hand aanzetten.
//
// De uurlijkse cron doet een kleine portie, zodat de intake niet stilvalt. Maar bij een
// achterstand (bijvoorbeeld alles wat binnenkwam vóór de sync bestond) wil je gewoon
// kunnen zeggen: werk 'm nu af. Dat is deze route.
//
// POST {}                → vult de wachtrij en werkt één portie af
// POST { portie: 20 }    → grotere portie (max 25 per aanroep)
// POST { alleen: "tel" } → alleen tellen, niets uploaden
import { svc } from "../lib/usage.mjs";
import { vulWachtrij, werkWachtrijAf, MAX_POGINGEN } from "../lib/dropboxsync.mjs";

const MAX_PORTIE = 25;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const db = svc();
  if (!db) return res.status(200).json({ error: "geen database" });

  const { portie = 6, alleen = "" } = req.body || {};

  try {
    const bij = await vulWachtrij(db);

    const tellen = async () => {
      const { count } = await db.from("dropbox_wachtrij")
        .select("id", { count: "exact", head: true })
        .in("status", ["wacht", "mislukt"]).lt("pogingen", MAX_POGINGEN);
      return count || 0;
    };

    if (alleen === "tel") return res.status(200).json({ toegevoegd: bij, open: await tellen() });

    const uploader = async ({ buffer, filename, doel }) => {
      const r = await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/dropbox/list`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload", name: filename, b64: buffer.toString("base64"),
          target: String(doel).replace(/^\//, ""), owner_type: "project",
        }),
      }).then((x) => x.json());
      if (r && r.error) throw new Error(String(r.error));
      return { link: r && r.file ? r.file.link : null };
    };

    // werkWachtrijAf pakt PORTIE rijen per aanroep; herhaal tot de gevraagde portie op is.
    const doel = Math.min(Number(portie) || 6, MAX_PORTIE);
    let gedaan = 0, mislukt = 0, over = 0, rondes = 0;
    while (gedaan + mislukt < doel && rondes < 10) {
      const uit = await werkWachtrijAf(db, uploader);
      rondes++;
      gedaan += uit.gedaan; mislukt += uit.mislukt; over = uit.over;
      if (!uit.gedaan && !uit.mislukt) break;
    }

    return res.status(200).json({ toegevoegd: bij, gedaan, mislukt, over });
  } catch (e) {
    console.error("dropboxsync", e && e.message);
    return res.status(200).json({ error: (e && e.message) || "sync mislukt" });
  }
}
