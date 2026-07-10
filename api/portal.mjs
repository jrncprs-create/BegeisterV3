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

// Eén projectpagina, opgebouwd uit precies de secties die aan staan.
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
  };

  // Voortgang staat in de fasebalk hierboven; geen aparte query nodig.

  if (zicht.omschrijving) pagina.omschrijving = p.description || "";
  if (zicht.notities)     pagina.notities = p.notes || "";

  if (zicht.taken) {
    const { data } = await db.from("items")
      .select("id,title,status").eq("project_id", pid).neq("status", "wait");
    pagina.taken = (data || []).map((it) => ({ t: it.title, done: it.status === "done" }));
  }

  if (zicht.afspraken) {
    const { data } = await db.from("appointments")
      .select("id,title,date,start_time").eq("project_id", pid).order("date");
    pagina.afspraken = (data || []).map((a) => ({ t: a.title, date: a.date, start: a.start_time }));
  }

  if (zicht.bestanden) {
    const { data } = await db.from("files")
      .select("id,name,link,created_at")
      .eq("owner_type", "project").eq("owner_id", pid).eq("visible_to_client", true);
    pagina.bestanden = data || [];
  }

  // Projectprijs: de klant ziet alleen de prijs (incl. btw), nooit inkoop of marge.
  if (zicht.projectprijs && p.projectprijs != null && p.projectprijs !== "") {
    const btw = (p.btw != null && p.btw !== "") ? Number(p.btw) : 21;
    const ex = Number(p.projectprijs);
    pagina.prijs = { excl: ex, btw, incl: ex * (1 + btw / 100) };
  }

  // Opmerkingen per sectie — het inklapbare draadje.
  const { data: cmts } = await db.from("comments")
    .select("id,sectie,author,body,van_klant,created_at")
    .eq("scope", "portal").eq("ref_id", pid).order("created_at");
  pagina.opmerkingen = {};
  for (const c of cmts || []) {
    const s = c.sectie || "algemeen";
    (pagina.opmerkingen[s] = pagina.opmerkingen[s] || []).push(c);
  }

  // Akkoord: één per project. Zichtbaar zolang de klant nog niet akkoord is.
  const { data: appr } = await db.from("approvals")
    .select("approved_at,snapshot_sha").eq("project_id", pid).maybeSingle();
  pagina.akkoord = appr || null;

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
      const { data: projecten } = await db.from("projects")
        .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties,created_at")
        .eq("client_id", ik.client.id).neq("archived", true).order("created_at");

      const paginas = [];
      for (const p of projecten || []) if (p.project) paginas.push(await projectPagina(db, p));

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
