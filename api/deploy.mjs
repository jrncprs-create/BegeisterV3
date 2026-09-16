// Deploy-endpoint: commit een bestand naar GitHub via de API — zonder browser-acrobatiek.
// Alleen team (zelfde toets als /api/portalbeheer). Vereist env GITHUB_TOKEN: een
// fine-grained token met alléén Contents read/write op deze repo, gezet als Railway-variable.
// De aanroeper stuurt base64-inhoud + sha256; de server controleert die checksum vóór het
// committen, zodat er nooit een half of verminkt bestand live kan gaan.
import crypto from "node:crypto";
import { svc } from "../lib/usage.mjs";

const REPO = process.env.GITHUB_REPO || "jrncprs-create/BegeisterV3";
const TAK = process.env.GITHUB_BRANCH || "main";

// Alleen deze plekken mogen via dit endpoint worden beschreven.
const TOEGESTAAN = [
  /^public\/[a-z0-9 ._-]+$/i,
  /^api\/[a-z0-9._/-]+\.mjs$/i,
  /^intake\/[a-z0-9._-]+\.mjs$/i,
  /^lib\/[a-z0-9._-]+\.mjs$/i,
  /^sql\/[a-z0-9._-]+\.sql$/i,
  /^server\.mjs$/,
  /^BACKLOG\.md$/,
  /^HANDOFF\.md$/,
];

function fout(res, code, tekst, extra) { return res.status(code).json({ error: tekst, ...(extra || {}) }); }

async function isTeam(db, req) {
  const kop = String(req.headers.authorization || "");
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  const { data: team } = await db.from("team_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return team ? data.user : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fout(res, 405, "alleen POST");
  const db = svc();
  const wie = await isTeam(db, req);
  if (!wie) return fout(res, 403, "alleen team");

  const ghToken = process.env.GITHUB_TOKEN || "";
  if (!ghToken) return fout(res, 500, "GITHUB_TOKEN ontbreekt — zet hem als Railway-variable");

  const { path: pad, content_b64, message, sha256 } = req.body || {};
  if (!pad || !content_b64 || !message) return fout(res, 400, "path, content_b64 en message zijn verplicht");
  if (String(pad).includes("..") || !TOEGESTAAN.some((re) => re.test(String(pad)))) {
    return fout(res, 400, "pad niet toegestaan: " + pad);
  }

  const buf = Buffer.from(String(content_b64), "base64");
  if (!buf.length) return fout(res, 400, "lege inhoud");
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha256 && hash !== String(sha256).toLowerCase()) {
    return fout(res, 400, "sha256 klopt niet", { verwacht: sha256, kreeg: hash });
  }

  const kop = {
    Authorization: `Bearer ${ghToken}`,
    "User-Agent": "begeister-deploy",
    Accept: "application/vnd.github+json",
  };

  // Huidige blob-sha ophalen (nodig bij update; ontbreekt bij een nieuw bestand).
  let blobSha = null;
  try {
    const huidige = await fetch(`https://api.github.com/repos/${REPO}/contents/${pad}?ref=${TAK}`, { headers: kop });
    if (huidige.ok) { const j = await huidige.json(); blobSha = j && j.sha ? j.sha : null; }
  } catch { /* nieuw bestand */ }

  const body = {
    message: String(message).slice(0, 72),
    content: buf.toString("base64"),
    branch: TAK,
    ...(blobSha ? { sha: blobSha } : {}),
  };
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${pad}`, {
    method: "PUT",
    headers: { ...kop, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return fout(res, 502, "GitHub weigerde de commit", { detail: j && j.message });

  return res.json({
    ok: true,
    pad,
    commit: j.commit && j.commit.sha,
    sha256: hash,
    bytes: buf.length,
    door: wie.email || wie.id,
  });
}
