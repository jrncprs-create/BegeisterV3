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

// Grove fases. Akkoord is geen fase meer maar een status op een voorstel.
const FASES = ["briefing", "voorstel", "productie", "oplevering", "betaald"];
const FASE_LABEL = {
  briefing: "Briefing", voorstel: "Voorstel", productie: "Productie",
  oplevering: "Oplevering", betaald: "Betaald",
};

const SECTIES = ["omschrijving", "feiten", "voortgang", "taken", "afspraken", "bestanden", "projectprijs", "notities"];

// Zes vaste mappen, overal hetzelfde. De onderliggende AI-categorie (Concept, Media, …) en
// de financiën-categorieën (Offertes/Inkoop/Facturen) blijven bestaan — dit is puur de
// groepering waaronder ze getoond worden.
const VASTE_MAPPEN = ["Briefing", "Concept & ontwerp", "Techniek", "Beeld", "Financieel", "Oplevering"];
function _zesMap(cat, naam) {
  const c = String(cat || "").trim().toLowerCase();
  const n = String(naam || "").toLowerCase();
  const w = (re) => new RegExp("(^|[^a-z])(" + re + ")([^a-z]|$)").test(n);
  if (c === "portaal") return "Portaal";
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
    toon_feiten: !!zicht.feiten,
    toon_voortgang: !!zicht.voortgang,
  };
  if (zicht.feiten) {
    try { const { data: fdata } = await db.from("facts").select("text").eq("project_id", pid).order("created_at");
      pagina.feiten = (fdata || []).map((f) => f.text).filter(Boolean); } catch (_) { pagina.feiten = []; }
  } else { pagina.feiten = []; }

  const [items, appts, files, docs, cmts, appr] = await Promise.all([
    db.from("items").select("id,title,status,client_zichtbaar").eq("project_id", pid).eq("client_zichtbaar", true),
    db.from("appointments").select("id,title,date,start_time,client_zichtbaar").eq("project_id", pid).eq("client_zichtbaar", true).order("date"),
    // L11d — zichtbaarheid is per bestand (visible_to_client, het klant-poppetje).
    // We halen alles op en filteren hieronder in JS; ter-akkoord-documenten doen ook mee.
    db.from("files").select("id,name,link,icon,visible_to_client,is_voorstel,voorstel_soort,ter_akkoord,akkoord_op,akkoord_door,sort_order").eq("owner_type", "project").eq("owner_id", pid),
    db.from("documents").select("id,filename,link,category,visible_to_client,is_voorstel,voorstel_soort,origin,ter_akkoord,akkoord_op,akkoord_door,sort_order").eq("project_id", pid).neq("origin", "file"),
    db.from("comments").select("id,sectie,author,body,van_klant,created_at").eq("scope", "portal").eq("ref_id", pid).order("created_at"),
    db.from("approvals").select("approved_at,snapshot_sha").eq("project_id", pid).maybeSingle(),
  ]);

  pagina.taken   = (items.data || []).filter((i) => i.status !== "wait").map((i) => ({ t: i.title, done: i.status === "done" }));
  pagina.wacht   = (items.data || []).filter((i) => i.status === "wait").map((i) => ({ t: i.title }));
  pagina.afspraken = (appts.data || []).map((a) => ({ t: a.title, date: a.date, start: a.start_time }));
  // Bestanden uit BEIDE bronnen samenvoegen (files + documents), zodat de klant dezelfde
  // bestanden ziet als in de Bestanden-map van de app.
  const _alle = (files.data || []).map((f) => ({ id: f.id, name: f.name, link: f.link, icon: f.icon, is_voorstel: f.is_voorstel, voorstel_soort: f.voorstel_soort, zichtbaar: !!f.visible_to_client, ter_akkoord: !!f.ter_akkoord, akkoord_op: f.akkoord_op || null, akkoord_door: f.akkoord_door || null, volg: (f.sort_order == null ? 1e9 : f.sort_order) }))
    .concat((docs.data || []).map((d) => ({ id: "doc:" + d.id, name: d.filename, link: d.link, icon: d.category, is_voorstel: d.is_voorstel, voorstel_soort: d.voorstel_soort, zichtbaar: !!d.visible_to_client, ter_akkoord: !!d.ter_akkoord, akkoord_op: d.akkoord_op || null, akkoord_door: d.akkoord_door || null, volg: (d.sort_order == null ? 1e9 : d.sort_order) })));
  _alle.sort((a, b) => (a.volg - b.volg) || String(a.name || "").localeCompare(String(b.name || "")));
  // Bestanden = per bestand zichtbaar gezet met het klant-poppetje (visible_to_client).
  // Documenten die nog OP een akkoord wachten staan alleen onder "Actie nodig" (niet dubbel);
  // na het akkoord verschijnen ze hier met de groene status.
  pagina.bestanden = _alle.filter((f) => (f.zichtbaar || f.akkoord_op) && !(f.ter_akkoord && !f.akkoord_op)).map((f) => ({ id: f.id, name: f.name, link: f.link, ter_akkoord: f.ter_akkoord, akkoord_op: f.akkoord_op, akkoord_door: f.akkoord_door }));
  // Voorstellen blijven los werken: gemarkeerd als voorstel én door het team zichtbaar gezet.
  pagina.voorstellen = _alle.filter((f) => f.is_voorstel && f.zichtbaar).map((f) => ({ id: f.id, name: f.name, link: f.link, soort: (f.voorstel_soort || "idee") }));
  // L11: documenten die op een klant-akkoord wachten (of net getekend zijn).
  pagina.ter_akkoord = _alle.filter((f) => f.ter_akkoord).map((f) => ({ id: f.id, name: f.name, link: f.link, akkoord_op: f.akkoord_op, akkoord_door: f.akkoord_door }));
  // De twee poorten: de klant geeft los akkoord op idee en op budget.
  pagina.poorten = { idee: p.idee_akkoord_op || null, budget: p.budget_akkoord_op || null };

  pagina.opmerkingen = {};
  for (const c of cmts.data || []) { const s = c.sectie || "algemeen"; (pagina.opmerkingen[s] = pagina.opmerkingen[s] || []).push(c); }

  pagina.akkoord = appr.data || null;
  return pagina;
}

async function projectVanKlant(db, pid, clientId) {
  const { data: p } = await db.from("projects")
    .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties,idee_akkoord_op,budget_akkoord_op,archived")
    .eq("id", pid).maybeSingle();
  if (!p || p.client_id !== clientId || p.archived) return null;
  return p;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fout(res, 405, "method not allowed");

  const db = svc();
  if (!db) return fout(res, 500, "geen database");

  const { action } = req.body || {};

  // Team-preview: een teamlid (Jeroen/Marlon) bekijkt de ECHTE portalpagina van één project,
  // zoals de klant het ziet. Zelfde render (projectPagina) — niets nieuws verzonnen.
  if (action === "preview") {
    try {
      const kop = String(req.headers.authorization || "");
      const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
      const { data: au } = token ? await db.auth.getUser(token) : { data: null };
      const uid = au && au.user && au.user.id;
      if (!uid) return fout(res, 401, "niet ingelogd");
      const { data: team } = await db.from("team_users").select("user_id").eq("user_id", uid).maybeSingle();
      if (!team) return fout(res, 403, "alleen team");
      const { project_id } = req.body || {};
      const { data: p } = await db.from("projects")
        .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties,portal_bg,portal_bg_image,idee_akkoord_op,budget_akkoord_op")
        .eq("id", project_id).maybeSingle();
      if (!p || !p.project) return fout(res, 404, "geen portaal voor dit project");
      const { data: klant } = p.client_id ? await db.from("clients").select("id,name,color").eq("id", p.client_id).maybeSingle() : { data: null };
      const pg = await projectPagina(db, p); pg.bg_image = p.portal_bg_image || null;
      return res.status(200).json({ klant: { naam: (klant && klant.name) || (p.client_id ? "Klant" : "—"), kleur: (klant && klant.color) || "#8a8a8a" }, projecten: [pg], preview: true });
    } catch (e) { return fout(res, 500, String(e.message || e)); }
  }

  const ik = await wieBelt(db, req);
  if (!ik) return fout(res, 401, "niet ingelogd");

  try {
    if (action === "data") {
      // Geen publiceer-drempel meer: de poppetjes (per item én per bestand) zijn de
      // zichtbaarheidsschakelaars. De klant ziet zijn eigen, niet-gearchiveerde projecten,
      // en daarbinnen precies wat het team zichtbaar heeft gezet.
      const { data: projecten } = await db.from("projects")
        .select("id,project,client_id,phase,description,notes,projectprijs,btw,portal_secties,portal_bg,portal_bg_image,idee_akkoord_op,budget_akkoord_op,created_at")
        .eq("client_id", ik.client.id).neq("archived", true).order("created_at");

      const paginas = [];
      for (const p of projecten || []) if (p.project) { const pg = await projectPagina(db, p); pg.bg_image = p.portal_bg_image || null; paginas.push(pg); }

      return res.status(200).json({
        klant: { naam: ik.client.name, kleur: ik.client.color },
        projecten: paginas,
      });
    }

    // L11 — de klant tekent per document. Naam + moment worden vastgelegd; het team krijgt een push.
    if (action === "doc_akkoord") {
      const { file_id } = req.body || {};
      const wie = ik.client.name || "Klant";
      const wanneer = new Date().toISOString();
      let naam = "document";
      if (String(file_id).startsWith("doc:")) {
        const did = String(file_id).slice(4);
        const { data: d0 } = await db.from("documents").select("filename,ter_akkoord").eq("id", did).maybeSingle();
        if (!d0 || !d0.ter_akkoord) return fout(res, 404, "niet ter akkoord");
        naam = d0.filename || naam;
        const { error } = await db.from("documents").update({ akkoord_op: wanneer, akkoord_door: wie }).eq("id", did);
        if (error) throw error;
      } else {
        const { data: f0 } = await db.from("files").select("name,ter_akkoord").eq("id", file_id).maybeSingle();
        if (!f0 || !f0.ter_akkoord) return fout(res, 404, "niet ter akkoord");
        naam = f0.name || naam;
        const { error } = await db.from("files").update({ akkoord_op: wanneer, akkoord_door: wie }).eq("id", file_id);
        if (error) throw error;
      }
      try {
        const { sendToAll } = await import("../lib/push.mjs");
        await sendToAll(db, { title: "Akkoord van " + wie, body: wie + " gaf akkoord op " + naam, url: "/" });
      } catch (_) {}
      return res.status(200).json({ ok: true, akkoord_op: wanneer, akkoord_door: wie });
    }

    if (action === "reactie") {
      const { project_id, sectie, body } = req.body || {};
      const tekst = String(body || "").trim();
      if (!tekst) return fout(res, 400, "lege reactie");
      if (tekst.length > 4000) return fout(res, 400, "reactie te lang");
      if (sectie && !SECTIES.includes(sectie) && sectie !== "algemeen" && !/^voorstel:(idee|budget)$/.test(sectie) && !/^doc:[\w:-]+$/.test(sectie)) return fout(res, 400, "onbekende sectie");

      const p = await projectVanKlant(db, project_id, ik.client.id);
      if (!p) return fout(res, 404, "niet gevonden");

      const { error } = await db.from("comments").insert({
        scope: "portal", ref_id: project_id, sectie: sectie || "algemeen",
        author: ik.client.name, body: tekst, van_klant: true,
      });
      if (error) throw error;

      // Bij een vraag over een document: de documentnaam in de melding, niet de sectie-code.
      let waar = sectie || "algemeen";
      if (/^doc:/.test(waar)) {
        try {
          const fid = waar.slice(4);
          if (fid.startsWith("doc:") || /^[0-9a-f-]{36}$/.test(fid)) {
            const did = fid.startsWith("doc:") ? fid.slice(4) : null;
            if (did) { const { data: d0 } = await db.from("documents").select("filename").eq("id", did).maybeSingle(); waar = 'vraag bij "' + ((d0 && d0.filename) || "document") + '"'; }
            else { const { data: f0 } = await db.from("files").select("name").eq("id", fid).maybeSingle(); waar = 'vraag bij "' + ((f0 && f0.name) || "document") + '"'; }
          }
        } catch (_) { waar = "vraag bij een document"; }
      }
      try {
        await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/notify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${ik.client.name} plaatste een opmerking`,
            body: `${p.project} · ${waar}`, url: "/",
          }),
        });
      } catch (e) { console.error("portal reactie melding", e && e.message); }

      return res.status(200).json({ ok: true });
    }

    // Akkoord op één spoor: idee of budget. Zodra beide sporen akkoord zijn, schuift het
    // project naar productie. Geen fase meer, maar een status per poort.
    if (action === "akkoord") {
      const { project_id } = req.body || {};
      const soort = (req.body && req.body.soort === "budget") ? "budget" : "idee";
      const p = await projectVanKlant(db, project_id, ik.client.id);
      if (!p) return fout(res, 404, "niet gevonden");

      const kol = soort === "budget" ? "budget_akkoord_op" : "idee_akkoord_op";
      if (p[kol]) return fout(res, 409, "hier is al akkoord op gegeven");

      const nu = new Date().toISOString();
      const patch = { [kol]: nu };
      // Het andere spoor al akkoord? Dan zijn beide poorten groen → productie.
      const ander = soort === "budget" ? p.idee_akkoord_op : p.budget_akkoord_op;
      if (ander) patch.phase = "productie";

      const { error } = await db.from("projects").update(patch).eq("id", project_id);
      if (error) throw error;

      // Historie: een akkoord-rij met snapshot per spoor (voor de zekerheid, niet fataal).
      try {
        const snapshot = { genomen_op: nu, soort, klant: ik.client.name, project: p.project, fase: patch.phase || p.phase };
        const sha = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
        await db.from("approvals").insert({
          project_id, doc_id: null, user_id: ik.user.id, client_id: ik.client.id,
          soort, snapshot, snapshot_sha: sha,
        });
      } catch (e) { console.error("portal akkoord historie", e && e.message); }

      try {
        await fetch(`http://127.0.0.1:${process.env.PORT || 8080}/api/notify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `${ik.client.name} gaf akkoord op ${soort}`, body: p.project + (patch.phase ? " · nu in productie" : ""), url: "/" }),
        });
      } catch (e) { console.error("portal akkoord melding", e && e.message); }

      return res.status(200).json({ ok: true, soort, productie: !!patch.phase });
    }

    return fout(res, 400, "onbekende actie");
  } catch (e) {
    console.error("portal", action, e && e.message);
    return fout(res, 500, "er ging iets mis");
  }
}
