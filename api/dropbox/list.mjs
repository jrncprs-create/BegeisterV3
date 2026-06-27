// Bladeren/zoeken in Dropbox + deel-link maken + opruimen (fase 4). Gebruikt het opgeslagen token (server-side).
import { svc, getAccessToken } from "../../lib/dropbox.mjs";
import { logUsage } from "../../lib/usage.mjs";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = "/Begeister";
const AKEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const anthropic = AKEY ? new Anthropic({ apiKey: AKEY }) : null;
const MODEL = "claude-sonnet-4-6";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const db = svc();
  const token = await getAccessToken(db);
  if (!token) return res.status(200).json({ connected: false });

  const { action = "list", path = "", query = "", dropbox_path = "", catalog = [], moves = [] } = req.body || {};
  const call = (ep, payload) =>
    fetch("https://api.dropboxapi.com/2/" + ep, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(r => r.json());

  const norm = e => ({ type: e[".tag"], name: e.name, path: e.path_lower, id: e.id || "" });

  try {
    if (action === "list") {
      const j = await call("files/list_folder", { path: path || "", recursive: false, limit: 1000 });
      if (j.error) return res.status(200).json({ connected: true, error: JSON.stringify(j.error) });
      const entries = (j.entries || []).map(norm)
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : (a.type === "folder" ? -1 : 1)));
      return res.status(200).json({ connected: true, path, entries });
    }
    if (action === "search") {
      const j = await call("files/search_v2", { query: query || "", options: { max_results: 50 } });
      const entries = (j.matches || []).map(m => m.metadata && m.metadata.metadata).filter(Boolean).map(norm);
      return res.status(200).json({ connected: true, entries });
    }
    if (action === "link") {
      let link = null;
      const c = await call("sharing/create_shared_link_with_settings", { path: dropbox_path });
      if (c.url) link = c.url;
      else {
        const l = await call("sharing/list_shared_links", { path: dropbox_path, direct_only: true });
        if (l.links && l.links[0]) link = l.links[0].url;
      }
      return res.status(200).json({ connected: true, link });
    }
    if (action === "scan") {
      const j = await call("files/list_folder", { path: ROOT, recursive: false, limit: 1000 });
      if (j.error) return res.status(200).json({ connected: true, error: JSON.stringify(j.error) });
      const files = (j.entries || []).filter(e => e[".tag"] === "file").map(e => ({ name: e.name, path: e.path_lower }));
      if (!files.length) return res.status(200).json({ connected: true, suggestions: [] });
      let byName = {};
      if (anthropic) {
        const cat = (catalog || []).map(c => `- ${c.client} · ${c.project || ""}`).join("\n") || "(geen)";
        const sys = "Je sorteert losse bestanden in mappen per klant en project. Kies voor elk bestand de best passende klant en (indien duidelijk) project uit de lijst, op basis van de bestandsnaam. Algemene Begeister-bedrijfsdocumenten (strategie, canvas, menustructuur, huisstijl e.d.) horen bij klant 'Begeister'. Bij twijfel: laat client en project leeg. Verzin geen klanten/projecten buiten de lijst. Geef ALLEEN geldige JSON.";
        const user = `KLANTEN · PROJECTEN:\n${cat}\n\nBESTANDEN:\n${files.map(f => f.name).join("\n")}\n\nGeef exact dit JSON-formaat:\n{"map":[{"name":"exacte bestandsnaam","client":"","project":""}]}`;
        try {
          const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 1500, system: sys, messages: [{ role: "user", content: user }] });
          try { await logUsage(db, { source: "organize", model: MODEL, inputTokens: resp.usage?.input_tokens || 0, outputTokens: resp.usage?.output_tokens || 0, webSearches: 0 }); } catch (_) {}
          const raw = resp.content.map(b => (b.type === "text" ? b.text : "")).join("");
          const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
          (parsed.map || []).forEach(m => { byName[m.name] = m; });
        } catch (_) {}
      }
      const suggestions = files.map(f => {
        const m = byName[f.name] || {};
        let client = (m.client || "").trim();
        let project = (m.project || "").trim();
        if (!client) { client = "Begeister"; project = ""; }   // losse/algemene docs → /Begeister/Begeister/
        const target = ROOT + "/" + client + (project ? "/" + project : "");
        return { name: f.name, from: f.path, client, project, to: target + "/" + f.name };
      });
      return res.status(200).json({ connected: true, suggestions });
    }
    if (action === "apply") {
      const results = [];
      for (const mv of (moves || [])) {
        if (!mv.from || !mv.to) { results.push({ name: mv.name, ok: false }); continue; }
        const folder = mv.to.slice(0, mv.to.lastIndexOf("/"));
        const parts = folder.split("/").filter(Boolean);
        let cur = "";
        for (const p of parts) { cur += "/" + p; await call("files/create_folder_v2", { path: cur, autorename: false }); }
        const r = await call("files/move_v2", { from_path: mv.from, to_path: mv.to, autorename: true });
        results.push({ name: mv.name, ok: !r.error });
      }
      return res.status(200).json({ connected: true, results });
    }
    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(200).json({ connected: true, error: String(e.message || e) });
  }
}
