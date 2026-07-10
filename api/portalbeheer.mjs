// Teamkant van het klantportaal. Hier schrijven Jeroen en Marlon de debrief, zetten ze de
// deliverables op een rij, en publiceren ze de pagina voor de klant.
//
// Dezelfde regel als bij /api/portal: de browser praat niet met de tabellen. Wie belt,
// wordt uit het token gehaald en getoetst aan `team_users`. Een klant die dit adres vindt,
// krijgt 403 — hij staat niet op de lijst.
import { svc } from "../lib/usage.mjs";

function fout(res, code, tekst) { return res.status(code).json({ error: tekst }); }

async function wieBelt(db, req) {
  const kop = String(req.headers.authorization || "");
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  const { data: team } = await db.from("team_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!team) return null;
  return data.user;
}

const schoon = (s, max) => String(s == null ? "" : s).slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return fout(res, 405, "method not allowed");

  const db = svc();
  if (!db) return fout(res, 500, "geen database");

  const ik = await wieBelt(db, req);
  if (!ik) return fout(res, 403, "geen toegang");

  const { action } = req.body || {};

  try {
    // Alle projecten, met de staat van hun debrief. Voor de lijst links.
    if (action === "projecten") {
      const { data: projecten } = await db
        .from("projects")
        .select("id,project,phase,client_id,offerte_vrijgegeven")
        .neq("archived", true).order("created_at");

      const { data: klanten } = await db.from("clients").select("id,name,color,kind").order("name");
      const { data: docs } = await db.from("portal_docs").select("id,project_id,kind,status");
      const { data: logins } = await db.from("client_users").select("client_id");

      const metLogin = new Set((logins || []).map((l) => l.client_id));
      return res.status(200).json({
        klanten: (klanten || []).map((k) => ({ ...k, heeft_login: metLogin.has(k.id) })),
        projecten: (projecten || []).filter((p) => p.project),
        docs: docs || [],
      });
    }

    // Het debriefdocument van een project. Bestaat het niet, dan maken we een leeg concept.
    if (action === "doc") {
      const { project_id, kind = "debrief" } = req.body || {};
      if (!project_id) return fout(res, 400, "geen project");

      let { data: doc } = await db.from("portal_docs")
        .select("*").eq("project_id", project_id).eq("kind", kind).maybeSingle();

      if (!doc) {
        const { data: p } = await db.from("projects").select("project").eq("id", project_id).maybeSingle();
        if (!p) return fout(res, 404, "project bestaat niet");
        const { data: nieuw, error } = await db.from("portal_docs").insert({
          project_id, kind, title: p.project || "",
          intro: "We spraken elkaar op … en hieronder staat hoe wij het hebben begrepen. Laat het weten als we er naast zitten.",
          body: "", status: "concept",
        }).select().single();
        if (error) throw error;
        doc = nieuw;
      }

      const { data: delv } = await db.from("deliverables").select("*").eq("doc_id", doc.id).order("sort");
      const { data: aanl } = await db.from("aanleveringen").select("*").eq("project_id", project_id).order("sort");
      const { data: appr } = await db.from("approvals").select("approved_at,snapshot_sha").eq("doc_id", doc.id).maybeSingle();

      return res.status(200).json({ doc, deliverables: delv || [], aanleveringen: aanl || [], akkoord: appr || null });
    }

    // Opslaan. Een document waar akkoord op is, blijft zoals het is.
    if (action === "opslaan") {
      const { doc_id, title, intro, body, deliverables } = req.body || {};
      const { data: doc } = await db.from("portal_docs").select("id,status").eq("id", doc_id).maybeSingle();
      if (!doc) return fout(res, 404, "niet gevonden");
      if (doc.status === "akkoord") return fout(res, 409, "hier is akkoord op gegeven; heropen het eerst");

      const { error: e1 } = await db.from("portal_docs").update({
        title: schoon(title, 200), intro: schoon(intro, 2000), body: schoon(body, 40000),
      }).eq("id", doc_id);
      if (e1) throw e1;

      if (Array.isArray(deliverables)) {
        await db.from("deliverables").delete().eq("doc_id", doc_id);
        const rijen = deliverables
          .filter((d) => String(d.label || "").trim())
          .map((d, i) => ({ doc_id, label: schoon(d.label, 300), toelichting: schoon(d.toelichting, 1000) || null, sort: i }));
        if (rijen.length) {
          const { error: e2 } = await db.from("deliverables").insert(rijen);
          if (e2) throw e2;
        }
      }
      return res.status(200).json({ ok: true });
    }

    // Publiceren, terugtrekken, en heropenen na akkoord.
    if (action === "status") {
      const { doc_id, naar } = req.body || {};
      if (!["concept", "gedeeld"].includes(naar)) return fout(res, 400, "onbekende status");

      const { data: doc } = await db.from("portal_docs").select("id,status,project_id").eq("id", doc_id).maybeSingle();
      if (!doc) return fout(res, 404, "niet gevonden");

      // Heropenen betekent: het akkoord vervalt. Dat is een echte handeling, geen knopje.
      if (doc.status === "akkoord") {
        await db.from("approvals").delete().eq("doc_id", doc_id);
        await db.from("projects").update({ phase: "debrief" }).eq("id", doc.project_id);
      }

      const wijziging = { status: naar };
      if (naar === "gedeeld" && !doc.published_at) wijziging.published_at = new Date().toISOString();
      const { error } = await db.from("portal_docs").update(wijziging).eq("id", doc_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // Aanleveringen: de hele lijst in één keer, zoals de deliverables.
    if (action === "aanleveringen") {
      const { project_id, rijen } = req.body || {};
      if (!project_id || !Array.isArray(rijen)) return fout(res, 400, "geen lijst");

      const { data: bestaand } = await db.from("aanleveringen").select("id,status,waarde_tekst,waarde_getal,aangeleverd_op").eq("project_id", project_id);
      const oud = new Map((bestaand || []).map((r) => [r.id, r]));

      // Wat de klant al heeft aangeleverd, blijft staan. Alleen wij bepalen de vraag,
      // niet het antwoord.
      const soorten = ["bedrag", "aantal", "bevestiging", "bestand", "tekst"];
      const nieuw = rijen.filter((r) => String(r.label || "").trim()).map((r, i) => {
        const b = r.id && oud.get(r.id);
        return {
          id: r.id || undefined,
          project_id,
          label: schoon(r.label, 300),
          toelichting: schoon(r.toelichting, 1000) || null,
          soort: soorten.includes(r.soort) ? r.soort : "tekst",
          blokkeert: !!r.blokkeert,
          sort: i,
          status: b ? b.status : "open",
          waarde_tekst: b ? b.waarde_tekst : null,
          waarde_getal: b ? b.waarde_getal : null,
          aangeleverd_op: b ? b.aangeleverd_op : null,
        };
      });

      const houden = new Set(nieuw.filter((r) => r.id).map((r) => r.id));
      const weg = (bestaand || []).filter((r) => !houden.has(r.id)).map((r) => r.id);
      if (weg.length) await db.from("aanleveringen").delete().in("id", weg);
      if (nieuw.length) {
        const { error } = await db.from("aanleveringen").upsert(nieuw, { onConflict: "id" });
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    // De offerte vrijgeven of weer dichtzetten.
    if (action === "offerte") {
      const { project_id, vrijgeven } = req.body || {};
      const { error } = await db.from("projects").update({ offerte_vrijgegeven: !!vrijgeven }).eq("id", project_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return fout(res, 400, "onbekende actie");
  } catch (e) {
    console.error("portalbeheer", action, e && e.message);
    return fout(res, 500, (e && e.message) || "er ging iets mis");
  }
}
