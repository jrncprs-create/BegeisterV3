// Bladeren/zoeken in Dropbox + deel-link maken. Gebruikt het opgeslagen token (server-side).
import { svc, getAccessToken } from "../../lib/dropbox.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const db = svc();
  const token = await getAccessToken(db);
  if (!token) return res.status(200).json({ connected: false });

  const { action = "list", path = "", query = "", dropbox_path = "" } = req.body || {};
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
    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(200).json({ connected: true, error: String(e.message || e) });
  }
}
