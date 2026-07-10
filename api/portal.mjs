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
// POST /api/portal { action: "data" }
// POST /api/portal { action: "reactie",     doc_id, body }
// POST /api/portal { action: "akkoord",     doc_id }
// POST /api/portal { action: "aanlevering", id, waarde }
import { createHash } from "node:crypto";
import { svc } from "../lib/usage.mjs";

const FASES = ["briefing", "debrief", "akkoord", "uitvoering", "oplevering", "gefactureerd"];

// De klant hoort de laatste fase niet als "gefactureerd" te zien; dat is onze boekhouding.
const FASE_LABEL = {
  briefing: "Briefing", debrief: "Debrief", akkoord: "Akkoord",
  uitvoering: "Uitvoering", oplevering: "Oplevering", gefactureerd: "Afgerond",
};

function fout(res, code, tekst) { return res.status(code).json({ error: tekst }); }

// Wie belt er? Geeft { user, client } of null.
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

// De projecten van deze klant die iets gepubliceerds hebben.
async function projectenVan(db, clientId) {
  const { data: projecten } = await db
    .from("projects").select("id,project,phase,offerte_vrijgegeven,created_at")
    .eq("client_id", clientId).neq("archived", true).order("created_at");
  if (!projecten || !projecten.length) return [];

  const ids = projecten.map((p) => p.id);
  const { data: docs } = await db
    .from("portal_docs").select("project_id,status").in("project_id", ids).neq("status", "concept");
  const zichtbaar = new Set((docs || []).map((d) => d.project_id));
  return projecten.filter((p) => zichtbaar.has(p.id));
}

// Alles wat één projectpagina nodig heeft.
async function projectPagina(db, project, clientId) {
  const pid = project.id;

  const [docsR, aanlR, filesR, apprR] = await Promise.all([
    db.from("portal_docs").select("*").eq("project_id", pid).neq("status", "concept"),
    db.from("aanleveringen").select("*").eq("project_id", pid).order("blokkeert", { ascending: false }).order("sort"),
    db.from("files").select("id,name,link,created_at").eq("owner_type", "project").eq("owner_id", pid).eq("visible_to_client", true),
    db.from("approvals").select("doc_id,approved_at,snapshot_sha").eq("project_id", pid),
  ]);

  const docs = docsR.data || [];
  const docIds = docs.map((d) => d.id);

  const [delvR, cmtR] = await Promise.all([
    docIds.length ? db.from("deliverables").select("*").in("doc_id", docIds).order("sort") : { data: [] },
    docIds.length ? db.from("comments").select("id,ref_id,author,body,van_klant,created_at").eq("scope", "portal_doc").in("ref_id", docIds).order("created_at") : { data: [] },
  ]);

  // De offerte alleen als wij hem hebben vrijgegeven.
  let offerte = null;
  if (project.offerte_vrijgegeven) {
    const { data: regels } = await db.from("quote_lines").select("*").eq("project_id", pid).order("sort");
    const posten = (regels || []).map((r) => ({
      label: r.label, aantal: Number(r.aantal), stukprijs: Number(r.stukprijs), btw: Number(r.btw),
      totaal: Number(r.aantal) * Number(r.stukprijs),
    }));
    const subtotaal = posten.reduce((s, p) => s + p.totaal, 0);
    const btw = posten.reduce((s, p) => s + p.totaal * (p.btw / 100), 0);
    offerte = { posten, subtotaal, btw, totaal: subtotaal + btw };
  }

  const akkoorden = apprR.data || [];
  const isAkkoord = akkoorden.length > 0;

  return {
    id: pid,
    naam: project.project,
    fase: project.phase,
    fase_index: Math.max(0, FASES.indexOf(project.phase)),
    fases: FASES.map((k) => ({ k, l: FASE_LABEL[k] })),
    docs: docs.map((d) => ({
      id: d.id, kind: d.kind, title: d.title, intro: d.intro, body: d.body, status: d.status,
      published_at: d.published_at,
      deliverables: (delvR.data || []).filter((x) => x.doc_id === d.id).map((x) => ({ label: x.label, toelichting: x.toelichting })),
      reacties: (cmtR.data || []).filter((c) => c.ref_id === d.id),
      akkoord: akkoorden.find((a) => a.doc_id === d.id) || null,
    })),
    aanleveringen: (aanlR.data || []).map((a) => ({
      id: a.id, label: a.label, toelichting: a.toelichting, soort: a.soort,
      blokkeert: a.blokkeert, status: a.status,
      waarde: a.soort === "bedrag" || a.soort === "aantal" ? a.waarde_getal : a.waarde_tekst,
      aangeleverd_op: a.aangeleverd_op,
    })),
    bestanden: filesR.data || [],
    offerte,
    // Bedragen verschijnen pas als er akkoord is. Daarvoor betekenen ze niets.
    geld: isAkkoord && offerte ? { totaal: offerte.totaal } : null,
  };
}

// Hoort dit document bij deze klant? Zo niet: het bestaat niet.
async function docVanKlant(db, docId, clientId) {
  const { data: doc } = await db.from("portal_docs").select("*").eq("id", docId).maybeSingle();
  if (!doc) return null;
  const { data: p } = await db.from("projects").select("id,client_id,project").eq("id", doc.project_id).maybeSingle();
  if (!p || p.client_id !== clientId) return null;
  return { doc, project: p };
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
      const projecten = await projectenVan(db, ik.client.id);
      const paginas = [];
      for (const p of projecten) paginas.push(await projectPagina(db, p, ik.client.id));
      return res.status(200).json({
        klant: { naam: ik.client.name, kleur: ik.client.color },
        projecten: paginas,
      });
    }

    if (action === "reactie") {
      const { doc_id, body } = req.body || {};
      const tekst = String(body || "").trim();
      if (!tekst) return fout(res, 400, "lege reactie");
      if (tekst.length > 4000) return fout(res, 400, "reactie te lang");

      const gevonden = await docVanKlant(db, doc_id, ik.client.id);
      if (!gevonden) return fout(res, 404, "niet gevonden");
      if (gevonden.doc.status === "akkoord") return fout(res, 409, "dit document staat vast");

      const { error } = await db.from("comments").insert({
        scope: "portal_doc", ref_id: doc_id, author: ik.client.name, body: tekst, van_klant: true,
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "akkoord") {
      const { doc_id } = req.body || {};
      const gevonden = await docVanKlant(db, doc_id, ik.client.id);
      if (!gevonden) return fout(res, 404, "niet gevonden");
      if (gevonden.doc.status === "concept") return fout(res, 409, "dit document is nog niet gedeeld");
      if (gevonden.doc.status === "akkoord") return fout(res, 409, "hier is al akkoord op gegeven");

      const { data: delv } = await db.from("deliverables").select("label,toelichting,sort").eq("doc_id", doc_id).order("sort");
      const { data: proj } = await db.from("projects").select("offerte_vrijgegeven").eq("id", gevonden.doc.project_id).single();
      const { data: regels } = proj.offerte_vrijgegeven
        ? await db.from("quote_lines").select("label,aantal,stukprijs,btw,sort").eq("project_id", gevonden.doc.project_id).order("sort")
        : { data: [] };

      // De momentopname is de opdrachtbevestiging. Wat hier in staat, is wat is afgesproken.
      const snapshot = {
        genomen_op: new Date().toISOString(),
        klant: ik.client.name,
        project: gevonden.project.project,
        document: { kind: gevonden.doc.kind, title: gevonden.doc.title, intro: gevonden.doc.intro, body: gevonden.doc.body },
        deliverables: delv || [],
        offerte: regels || [],
      };
      const sha = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

      const { error: e1 } = await db.from("approvals").insert({
        project_id: gevonden.doc.project_id, doc_id, user_id: ik.user.id,
        client_id: ik.client.id, snapshot, snapshot_sha: sha,
      });
      if (e1) {
        if (String(e1.code) === "23505") return fout(res, 409, "hier is al akkoord op gegeven");
        throw e1;
      }

      await db.from("portal_docs").update({ status: "akkoord" }).eq("id", doc_id);
      if (gevonden.doc.kind === "debrief") {
        await db.from("projects").update({ phase: "akkoord" }).eq("id", gevonden.doc.project_id);
      }

      // Het team weten. Mislukt dat, dan is het akkoord er nog steeds.
      try {
        await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/notify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${ik.client.name} gaf akkoord`,
            body: `${gevonden.project.project} — ${gevonden.doc.title || gevonden.doc.kind}`,
            url: "/",
          }),
        });
      } catch (e) { console.error("portal akkoord melding", e && e.message); }

      return res.status(200).json({ ok: true, sha, akkoord_op: new Date().toISOString() });
    }

    if (action === "aanlevering") {
      const { id, waarde } = req.body || {};
      const { data: a } = await db.from("aanleveringen").select("*").eq("id", id).maybeSingle();
      if (!a) return fout(res, 404, "niet gevonden");
      const { data: p } = await db.from("projects").select("client_id").eq("id", a.project_id).maybeSingle();
      if (!p || p.client_id !== ik.client.id) return fout(res, 404, "niet gevonden");

      const wijziging = { status: "aangeleverd", aangeleverd_op: new Date().toISOString() };
      if (a.soort === "bedrag" || a.soort === "aantal") {
        const n = Number(waarde);
        if (!isFinite(n)) return fout(res, 400, "geen geldig getal");
        wijziging.waarde_getal = n;
      } else if (a.soort === "bevestiging") {
        if (waarde !== true) return fout(res, 400, "geen bevestiging");
        wijziging.waarde_tekst = "ja";
      } else {
        const t = String(waarde || "").trim();
        if (!t) return fout(res, 400, "leeg");
        wijziging.waarde_tekst = t.slice(0, 4000);
      }

      const { error } = await db.from("aanleveringen").update(wijziging).eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return fout(res, 400, "onbekende actie");
  } catch (e) {
    console.error("portal", action, e && e.message);
    return fout(res, 500, "er ging iets mis");
  }
}
