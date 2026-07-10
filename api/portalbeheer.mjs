// Teamkant van het klantportaal. Hier bepalen Jeroen en Marlon per project wat de klant
// van het dossier ziet. Zelfde regel als /api/portal: de browser praat niet met de
// tabellen, de server toetst elke aanroep aan `team_users`. Een klant krijgt hier 403.
import { svc } from "../lib/usage.mjs";

const FASES = ["briefing", "debrief", "akkoord", "uitvoering", "oplevering", "gefactureerd"];
const FASE_LABEL = {
  briefing: "Briefing", debrief: "Debrief", akkoord: "Akkoord",
  uitvoering: "Uitvoering", oplevering: "Oplevering", gefactureerd: "Betaald",
};
const SECTIES = ["omschrijving", "voortgang", "taken", "afspraken", "bestanden", "projectprijs", "notities"];

function fout(res, code, tekst) { return res.status(code).json({ error: tekst }); }

async function isTeam(db, req) {
  const kop = String(req.headers.authorization || "");
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  const { data: team } = await db.from("team_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return team ? data.user : null;
}

// Het volledige dossier van een project — team ziet alle secties, ook de uitgezette,
// zodat de schakelaars iets hebben om te tonen. De zichtbaarheid staat in `secties`.
async function dossier(db, p) {
  const z = (p.portal_secties) || {};
  const secties = {}; for (const s of SECTIES) secties[s] = !!z[s];

  const [taken, appts, files, cmts, appr] = await Promise.all([
    db.from("items").select("id,title,status").eq("project_id", p.id).neq("status", "wait"),
    db.from("appointments").select("id,title,date,start_time").eq("project_id", p.id).order("date"),
    db.from("files").select("id,name,link,visible_to_client").eq("owner_type", "project").eq("owner_id", p.id),
    db.from("comments").select("id,sectie,author,body,van_klant,created_at").eq("scope", "portal").eq("ref_id", p.id).order("created_at"),
    db.from("approvals").select("approved_at,snapshot_sha").eq("project_id", p.id).maybeSingle(),
  ]);

  const btw = (p.btw != null && p.btw !== "") ? Number(p.btw) : 21;
  const prijs = (p.projectprijs != null && p.projectprijs !== "")
    ? { excl: Number(p.projectprijs), btw, incl: Number(p.projectprijs) * (1 + btw / 100) } : null;

  const opmerkingen = {};
  for (const c of cmts.data || []) { const s = c.sectie || "algemeen"; (opmerkingen[s] = opmerkingen[s] || []).push(c); }

  return {
    id: p.id, naam: p.project, fase: p.phase,
    fase_index: Math.max(0, FASES.indexOf(p.phase)),
    fases: FASES.map((k) => ({ k, l: FASE_LABEL[k] })),
    secties,
    omschrijving: p.description || "",
    notities: p.notes || "",
    taken: (taken.data || []).map((it) => ({ t: it.title, done: it.status === "done" })),
    afspraken: (appts.data || []).map((a) => ({ t: a.title, date: a.date, start: a.start_time })),
    bestanden: files.data || [],
    prijs,
    opmerkingen,
    akkoord: appr.data || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fout(res, 405, "method not allowed");
  const db = svc();
  if (!db) return fout(res, 500, "geen database");

  const ik = await isTeam(db, req);
  if (!ik) return fout(res, 403, "geen toegang");

  const { action } = req.body || {};

  try {
    if (action === "projecten") {
      const { data: projecten } = await db.from("projects")
        .select("id,project,phase,client_id").neq("archived", true).order("created_at");
      const { data: klanten } = await db.from("clients").select("id,name,color,kind").order("name");
      const { data: logins } = await db.from("client_users").select("client_id");
      const metLogin = new Set((logins || []).map((l) => l.client_id));
      return res.status(200).json({
        klanten: (klanten || []).map((k) => ({ ...k, heeft_login: metLogin.has(k.id) })),
        projecten: (projecten || []).filter((p) => p.project),
      });
    }

    if (action === "project") {
      const { project_id } = req.body || {};
      const { data: p } = await db.from("projects")
        .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties").eq("id", project_id).maybeSingle();
      if (!p) return fout(res, 404, "niet gevonden");
      const { data: klant } = await db.from("clients").select("id,name,color").eq("id", p.client_id).maybeSingle();
      return res.status(200).json({ klant: klant || { name: "—", color: "#8a8a8a" }, pagina: await dossier(db, p) });
    }

    if (action === "toggle") {
      const { project_id, sectie, aan } = req.body || {};
      if (!SECTIES.includes(sectie)) return fout(res, 400, "onbekende sectie");
      const { data: p } = await db.from("projects").select("portal_secties").eq("id", project_id).maybeSingle();
      if (!p) return fout(res, 404, "niet gevonden");
      const z = Object.assign({}, p.portal_secties || {}, { [sectie]: !!aan });
      const { error } = await db.from("projects").update({ portal_secties: z }).eq("id", project_id);
      if (error) throw error;
      return res.status(200).json({ ok: true, secties: z });
    }

    if (action === "bestand") {
      const { file_id, zichtbaar } = req.body || {};
      const { error } = await db.from("files").update({ visible_to_client: !!zichtbaar }).eq("id", file_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // Team plaatst zelf een opmerking (antwoord op de klant).
    if (action === "reactie") {
      const { project_id, sectie, body } = req.body || {};
      const tekst = String(body || "").trim();
      if (!tekst) return fout(res, 400, "leeg");
      const { error } = await db.from("comments").insert({
        scope: "portal", ref_id: project_id, sectie: sectie || "algemeen",
        author: "Begeister", body: tekst.slice(0, 4000), van_klant: false,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return fout(res, 400, "onbekende actie");
  } catch (e) {
    console.error("portalbeheer", action, e && e.message);
    return fout(res, 500, (e && e.message) || "er ging iets mis");
  }
}
