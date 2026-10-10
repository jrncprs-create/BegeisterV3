// Gezondheidscheck: lost wezen en duplicaten zelf op in plaats van ze te melden.
// Niets wordt verwijderd: een rij krijgt archived_at + archief_reden en verdwijnt zo uit de weergave.
// Pure functies (beslissen) + één uitvoerfunctie (schrijven), zodat de beslissingen testbaar zijn.
// Test: node --test lib/gezondheid-opruimen.test.mjs

// Welke files-rijen moeten in het archief, en waarom. projIds/itemIds = Sets van id-strings.
export function beslisFiles(files, projIds, itemIds) {
  const uit = [];
  const actief = files.filter(f => !f.archived_at);
  for (const f of actief) {
    if (f.owner_type === "project" && !projIds.has(String(f.owner_id))) uit.push({ id: f.id, reden: "wees: project bestaat niet meer" });
    else if (f.owner_type === "task" && !itemIds.has(String(f.owner_id))) uit.push({ id: f.id, reden: "wees: taak bestaat niet meer" });
  }
  const al = new Set(uit.map(x => x.id));
  // Duplicaten binnen een project: nieuwste blijft, oudere gaan in het archief.
  const groepen = {};
  for (const f of actief) {
    if (al.has(f.id) || f.owner_type !== "project" || !f.name) continue;
    const k = String(f.owner_id) + "|" + String(f.name).toLowerCase();
    (groepen[k] = groepen[k] || []).push(f);
  }
  for (const g of Object.values(groepen)) {
    if (g.length < 2) continue;
    g.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    for (const oud of g.slice(1)) uit.push({ id: oud.id, reden: "dubbel: nieuwere versie van \"" + g[0].name + "\" blijft" });
  }
  return uit;
}

// Zelfde voor documents (origin 'file' zijn kopieën van files-rijen en doen niet mee).
export function beslisDocumenten(docs, projIds) {
  const uit = [];
  const actief = docs.filter(d => !d.archived_at && d.origin !== "file");
  for (const d of actief) if (d.project_id && !projIds.has(String(d.project_id))) uit.push({ id: d.id, reden: "wees: project bestaat niet meer" });
  const al = new Set(uit.map(x => x.id));
  const groepen = {};
  for (const d of actief) {
    if (al.has(d.id) || !d.project_id || !d.filename) continue;
    const k = String(d.project_id) + "|" + String(d.filename).toLowerCase();
    (groepen[k] = groepen[k] || []).push(d);
  }
  for (const g of Object.values(groepen)) {
    if (g.length < 2) continue;
    g.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    for (const oud of g.slice(1)) uit.push({ id: oud.id, reden: "dubbel: nieuwere versie van \"" + g[0].filename + "\" blijft" });
  }
  return uit;
}

// Schrijft de beslissingen weg. Geeft het aantal gearchiveerde rijen per tabel terug.
export async function archiveer(db, tabel, beslissingen) {
  const nu = new Date().toISOString();
  let n = 0;
  for (const b of beslissingen) {
    const { error } = await db.from(tabel).update({ archived_at: nu, archief_reden: b.reden }).eq("id", b.id);
    if (error) throw new Error(tabel + " " + b.id + " archiveren: " + error.message);
    n++;
  }
  return n;
}
