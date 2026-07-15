// U17 — Wekelijkse gezondheidscheck. Automatiseert de audit van 14 juli:
// 1) dubbele bestanden (zelfde naam binnen hetzelfde project, in files én/of documents),
// 2) wezen (bestanden die naar een niet-bestaand project of niet-bestaande taak wijzen),
// 3) rare financiële waardes (project in/na voorstel-fase zonder plausibele projectprijs).
// Bevindingen komen als één taakkaart met checklist ("Gezondheidscheck") + een push.
// Geen bevindingen = geen kaart en geen melding (stilte is ook informatie).
import { sendToAll } from "./push.mjs";

const TITEL = "Gezondheidscheck — bevindingen";

export async function draaiGezondheidscheck(db) {
  const bevindingen = [];

  const [projs, items, files, docs] = await Promise.all([
    db.from("projects").select("id, client, project, phase, invoice_status, projectprijs, archived"),
    db.from("items").select("id"),
    db.from("files").select("id, name, owner_type, owner_id"),
    db.from("documents").select("id, filename, project_id, origin"),
  ]);
  const projecten = projs.data || [];
  const projIds = new Set(projecten.map(p => String(p.id)));
  const itemIds = new Set((items.data || []).map(i => String(i.id)));
  const alleFiles = files.data || [];
  const alleDocs = (docs.data || []).filter(d => d.origin !== "file"); // origin='file' zijn kopieën van files-rijen

  // 1) Duplicaten: zelfde bestandsnaam meer dan eens binnen hetzelfde project.
  const perSleutel = {};
  alleFiles.forEach(f => {
    if (f.owner_type !== "project" || !f.name) return;
    const k = String(f.owner_id) + "|" + String(f.name).toLowerCase();
    perSleutel[k] = (perSleutel[k] || 0) + 1;
  });
  alleDocs.forEach(d => {
    if (!d.project_id || !d.filename) return;
    const k = String(d.project_id) + "|" + String(d.filename).toLowerCase();
    perSleutel[k] = (perSleutel[k] || 0) + 1;
  });
  Object.entries(perSleutel).forEach(([k, n]) => {
    if (n < 2) return;
    const [pid, naam] = k.split("|");
    const p = projecten.find(x => String(x.id) === pid);
    const waar = p ? (p.client || "?") + (p.project ? " · " + p.project : "") : "onbekend project";
    bevindingen.push(`Dubbel bestand: "${naam}" staat ${n}× bij ${waar}`);
  });

  // 2) Wezen: bestanden die naar iets wijzen dat niet (meer) bestaat.
  alleFiles.forEach(f => {
    if (f.owner_type === "project" && !projIds.has(String(f.owner_id)))
      bevindingen.push(`Weesbestand: "${f.name || f.id}" wijst naar een onbekend project`);
    if (f.owner_type === "task" && !itemIds.has(String(f.owner_id)))
      bevindingen.push(`Weesbestand: "${f.name || f.id}" hangt aan een verwijderde taak`);
  });
  alleDocs.forEach(d => {
    if (d.project_id && !projIds.has(String(d.project_id)))
      bevindingen.push(`Weesdocument: "${d.filename || d.id}" wijst naar een onbekend project`);
  });

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
    return { bevindingen: 0 };
  }

  const checklist = bevindingen.slice(0, 30).map(t => ({ t, done: false }));
  const { data: bestaand } = await db.from("items").select("id").eq("title", TITEL).neq("status", "done").maybeSingle();
  if (bestaand) await db.from("items").update({ checklist, status: "todo" }).eq("id", bestaand.id);
  else await db.from("items").insert({ title: TITEL, status: "todo", checklist, owner: null });

  try {
    await sendToAll(db, { title: "Gezondheidscheck", body: bevindingen.length + " bevinding" + (bevindingen.length === 1 ? "" : "en") + " — zie de taakkaart", url: "/" });
  } catch (_) {}
  return { bevindingen: bevindingen.length };
}
