// U17 — Wekelijkse gezondheidscheck. Automatiseert de audit van 14 juli:
// 1) dubbele bestanden (zelfde naam binnen hetzelfde project, in files én/of documents),
// 2) wezen (bestanden die naar een niet-bestaand project of niet-bestaande taak wijzen),
// 3) rare financiële waardes (project in/na voorstel-fase zonder plausibele projectprijs).
// Sinds 10 okt 2026: wezen en duplicaten worden ZELF opgelost (archief, niets weg) en in het
// logboek gezet; alleen de prijscheck blijft een beslissing voor een mens en wordt een taakkaart + push.
import { sendToAll } from "./push.mjs";
import { beslisFiles, beslisDocumenten, archiveer } from "./gezondheid-opruimen.mjs";

const TITEL = "Gezondheidscheck — bevindingen";

export async function draaiGezondheidscheck(db) {
  const bevindingen = [];

  const [projs, items, files, docs] = await Promise.all([
    db.from("projects").select("id, client, project, phase, invoice_status, projectprijs, archived"),
    db.from("items").select("id"),
    db.from("files").select("id, name, owner_type, owner_id, created_at, archived_at"),
    db.from("documents").select("id, filename, project_id, origin, created_at, archived_at"),
  ]);
  const projecten = projs.data || [];
  const projIds = new Set(projecten.map(p => String(p.id)));
  const itemIds = new Set((items.data || []).map(i => String(i.id)));
  const alleFiles = files.data || [];

  // 1 en 2) Duplicaten en wezen: zelf oplossen. Nieuwste blijft, de rest gaat in het archief.
  const opgeruimd = { files: 0, documents: 0 };
  const fb = beslisFiles(alleFiles, projIds, itemIds);
  const dbes = beslisDocumenten(docs.data || [], projIds);
  opgeruimd.files = await archiveer(db, "files", fb);
  opgeruimd.documents = await archiveer(db, "documents", dbes);
  if (fb.length || dbes.length) {
    console.log("gezondheidscheck opgeruimd:", [...fb, ...dbes].map(x => x.reden).join(" | "));
  }

  // 3) Rare financiële waardes: klantproject voorbij de briefing zonder plausibele prijs.
  const intern = c => { const s = String(c || "").trim().toLowerCase(); return s === "begeister" || /priv[eé]$/.test(s); };
  projecten.forEach(p => {
    if (p.archived || intern(p.client)) return;
    const ver = ["voorstel", "productie", "oplevering", "betaald"].includes(p.phase || "")
             || ["geoffreerd", "gefactureerd", "betaald"].includes(p.invoice_status || "");
    if (!ver) return;
    const prijs = (p.projectprijs != null && p.projectprijs !== "") ? Number(p.projectprijs) : null;
    if (prijs == null) bevindingen.push(`Geen projectprijs: ${p.client}${p.project ? " · " + p.project : ""} (fase ${p.phase || "?"})`);
    else if (prijs > 0 && prijs < 100) bevindingen.push(`Verdachte projectprijs €${prijs}: ${p.client}${p.project ? " · " + p.project : ""} — testwaarde?`);
  });

  if (!bevindingen.length) {
    // Oude open check-kaart zonder actuele bevindingen mag dicht.
    try { await db.from("items").update({ status: "done", archived_at: new Date().toISOString() }).eq("title", TITEL).neq("status", "done"); } catch (_) {}
    return { bevindingen: 0, opgeruimd };
  }

  const checklist = bevindingen.slice(0, 30).map(t => ({ t, done: false }));
  const { data: bestaand } = await db.from("items").select("id").eq("title", TITEL).neq("status", "done").maybeSingle();
  if (bestaand) await db.from("items").update({ checklist, status: "todo" }).eq("id", bestaand.id);
  else await db.from("items").insert({ title: TITEL, status: "todo", checklist, owner: null });

  try {
    await sendToAll(db, { title: "Gezondheidscheck", body: bevindingen.length + " bevinding" + (bevindingen.length === 1 ? "" : "en") + " — zie de taakkaart", url: "/" });
  } catch (_) {}
  return { bevindingen: bevindingen.length, opgeruimd };
}
