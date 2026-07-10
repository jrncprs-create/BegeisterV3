// Klantportaal — alle data voor de klant loopt hier langs, en nergens anders.
//
// Het uitgangspunt: de browser van de klant praat niet met Supabase. Hij stuurt zijn
// toegangstoken mee, wij vragen Supabase wie dat is, zoeken op bij welke klant hij hoort,
// en halen daarna met de service-role sleutel alleen díe klant zijn gegevens op.
//
// Daarom staat er in dit bestand nergens een `client_id` uit de body. Wie hem daar zou
// lezen, laat de klant zelf bepalen wiens gegevens hij krijgt. De klant-id komt altijd
// uit het token.
//
// Het portaal is het projectdossier, read-only, met per project een zichtbaarheidslaag
// (projects.portal_secties). Wat uit staat, verlaat de server niet — verbergen in de
// browser is geen beveiliging.
//
// POST /api/portal { action: "data" }
// POST /api/portal { action: "reactie", project_id, sectie, body }
// POST /api/portal { action: "akkoord", project_id }
import { createHash } from "node:crypto";
import { svc } from "../lib/usage.mjs";

const FASES = ["briefing", "debrief", "akkoord", "uitvoering", "oplevering", "gefactureerd"];

// De klant hoort de laatste fase niet als "gefactureerd" te zien; voor hem is dat "Betaald".
const FASE_LABEL = {
  briefing: "Briefing", debrief: "Debrief", akkoord: "Akkoord",
  uitvoering: "Uitvoering", oplevering: "Oplevering", gefactureerd: "Betaald",
};

const SECTIES = ["omschrijving", "voortgang", "taken", "afspraken", "bestanden", "projectprijs", "notities"];

// Zes vaste mappen, overal hetzelfde. De onderliggende AI-categorie (Concept, Media, …) en
// de financiën-categorieën (Offertes/Inkoop/Facturen) blijven bestaan — dit is puur de
// groepering waaronder ze getoond worden.
const VASTE_MAPPEN = ["Briefing", "Concept & ontwerp", "Techniek", "Beeld", "Financieel", "Oplevering"];
function _zesMap(cat, naam) {
  const c = String(cat || "").trim().toLowerCase();
  const n = String(naam || "").toLowerCase();
  const w = (re) => new RegExp("(^|[^a-z])(" + re + ")([^a-z]|$)").test(n);
  if (["offertes", "inkoop", "facturen"].includes(c) || w("offerte|offertes|factuur|facturen|invoice|inkoop|bon|budget|calculatie|prijsopgave")) return "Financieel";
  if (w("projectbrief|briefing|aanvraag|debrief|intake")) return "Briefing";
  if (w("oplevering|nazorg|eindresultaat|aftermovie")) return "Oplevering";
  if (["media"].includes(c) || /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|svg|mp4|mov|avi|mkv|webm)$/.test(n)) return "Beeld";
  if (["concept", "lichtontwerp", "decor"].includes(c)) return "Concept & ontwerp";
  if (["tekeningen", "plattegronden", "draaiboek", "planning", "leveranciers", "techniek"].includes(c)) return "Techniek";
  return "Concept & ontwerp";
}
function _mapVan(f) { return _zesMap(f && f.icon, f && f.name); }

function fout(res, code, tekst) { return res.status(code).json({ error: tekst }); }

async function wieBelt(db, req) {
  const kop = String(req.headers.authorization || "");
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  const { data: koppeling } = await db
    .from("client_users").select("client_id").eq("user_id", data.user.id).maybeSingle();
  if (!koppeling) return null;
  const { data: klant } = await db
    .from("clients").select("id,name,color").eq("id", koppeling.client_id).maybeSingle();
  if (!klant) return null;
  return { user: data.user, client: klant };
}

function zichtbaar(p) {
  const z = (p && p.portal_secties) || {};
  const uit = {};
  for (const s of SECTIES) uit[s] = !!z[s];
  return uit;
}

// Eén projectpagina — hetzelfde dossier dat het team in de overlay ziet, maar alleen de
// aangevinkte items, read-only. Omschrijving/voortgang via portal_secties; taken, afspraken
// en bestanden per item (client_zichtbaar / visible_to_client).
async function projectPagina(db, p) {
  const zicht = zichtbaar(p);
  const pid = p.id;

  const pagina = {
    id: pid,
    naam: p.project,
    fase: p.phase,
    fase_index: Math.max(0, FASES.indexOf(p.phase)),
    fases: FASES.map((k) => ({ k, l: FASE_LABEL[k] })),
    secties: zicht,
    omschrijving: zicht.omschrijving ? (p.description || "") : "",
    toon_omschrijving: !!zicht.omschrijving,
    toon_voortgang: !!zicht.voortgang,
  };

  const [items, appts, files, cmts, appr] = await Promise.all([
    db.from("items").select("id,title,status,client_zichtbaar").eq("project_id", pid).eq("client_zichtbaar", true),
    db.from("appointments").select("id,title,date,start_time,client_zichtbaar").eq("project_id", pid).eq("client_zichtbaar", true).order("date"),
    db.from("files").select("id,name,link,icon,visible_to_client,is_voorstel").eq("owner_type", "project").eq("owner_id", pid).eq("visible_to_client", true),
    db.from("comments").select("id,sectie,author,body,van_klant,created_at").eq("scope", "portal").eq("ref_id", pid).order("created_at"),
    db.from("approvals").select("approved_at,snapshot_sha").eq("project_id", pid).maybeSingle(),
  ]);

  pagina.taken   = (items.data || []).filter((i) => i.status !== "wait").map((i) => ({ t: i.title, done: i.status === "done" }));
  pagina.wacht   = (items.data || []).filter((i) => i.status === "wait").map((i) => ({ t: i.title }));
  pagina.afspraken = (appts.data || []).map((a) => ({ t: a.title, date: a.date, start: a.start_time }));
  // Bestanden met hun map, zodat de klantpagina dezelfde mappenstructuur toont.
  pagina.bestanden = (files.data || []).map((f) => ({ id: f.id, name: f.name, link: f.link, map: _mapVan(f) }));
  pagina.voorstellen = (files.data || []).filter((f) => f.is_voorstel).map((f) => ({ id: f.id, name: f.name, link: f.link, map: _mapVan(f) }));

  pagina.opmerkingen = {};
  for (const c of cmts.data || []) { const s = c.sectie || "algemeen"; (pagina.opmerkingen[s] = pagina.opmerkingen[s] || []).push(c); }

  pagina.akkoord = appr.data || null;
  return pagina;
}

async function projectVanKlant(db, pid, clientId) {
  const { data: p } = await db.from("projects")
    .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties,archived")
    .eq("id", pid).maybeSingle();
  if (!p || p.client_id !== clientId || p.archived) return null;
  return p;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fout(res, 405, "method not allowed");

  const db = svc();
  if (!db) return fout(res, 500, "geen database");

  const ik = await wieBelt(db, req);
  if (!ik) return fout(res, 401, "niet ingelogd");

  const { action } = req.body || {};

  try {
    if (action === "data") {
      // Alleen gepubliceerde projecten. Wat niet gepubliceerd is, bestaat niet voor de klant.
      const { data: projecten } = await db.from("projects")
        .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties,portal_bg,created_at")
        .eq("client_id", ik.client.id).eq("portal_gepubliceerd", true).neq("archived", true).order("created_at");

      const paginas = [];
      for (const p of projecten || []) if (p.project) { const pg = await projectPagina(db, p); pg.bg = p.portal_bg || null; paginas.push(pg); }

      return res.status(200).json({
        klant: { naam: ik.client.name, kleur: ik.client.color },
        projecten: paginas,
      });
    }

    if (action === "reactie") {
      const { project_id, sectie, body } = req.body || {};
      const tekst = String(body || "").trim();
      if (!tekst) return fout(res, 400, "lege reactie");
      if (tekst.length > 4000) return fout(res, 400, "reactie te lang");
      if (sectie && !SECTIES.includes(sectie) && sectie !== "algemeen") return fout(res, 400, "onbekende sectie");

      const p = await projectVanKlant(db, project_id, ik.client.id);
      if (!p) return fout(res, 404, "niet gevonden");

      const { error } = await db.from("comments").insert({
        scope: "portal", ref_id: project_id, sectie: sectie || "algemeen",
        author: ik.client.name, body: tekst, van_klant: true,
      });
      if (error) throw error;

      try {
        await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/notify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${ik.client.name} plaatste een opmerking`,
            body: `${p.project} · ${sectie || "algemeen"}`, url: "/",
          }),
        });
      } catch (e) { console.error("portal reactie melding", e && e.message); }

      return res.status(200).json({ ok: true });
    }

    if (action === "akkoord") {
      const { project_id } = req.body || {};
      const p = await projectVanKlant(db, project_id, ik.client.id);
      if (!p) return fout(res, 404, "niet gevonden");

      const { data: bestaat } = await db.from("approvals").select("id").eq("project_id", project_id).maybeSingle();
      if (bestaat) return fout(res, 409, "hier is al akkoord op gegeven");

      const snapshot = {
        genomen_op: new Date().toISOString(),
        klant: ik.client.name, project: p.project, fase: p.phase,
        omschrijving: p.description || "",
      };
      const sha = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

      const { error } = await db.from("approvals").insert({
        project_id, doc_id: null, user_id: ik.user.id, client_id: ik.client.id,
        snapshot, snapshot_sha: sha,
      });
      if (error) {
        if (String(error.code) === "23505") return fout(res, 409, "hier is al akkoord op gegeven");
        throw error;
      }
      await db.from("projects").update({ phase: "akkoord" }).eq("id", project_id).eq("phase", "debrief");

      try {
        await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/notify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `${ik.client.name} gaf akkoord`, body: p.project, url: "/" }),
        });
      } catch (e) { console.error("portal akkoord melding", e && e.message); }

      return res.status(200).json({ ok: true, sha });
    }

    return fout(res, 400, "onbekende actie");
  } catch (e) {
    console.error("portal", action, e && e.message);
    return fout(res, 500, "er ging iets mis");
  }
}
