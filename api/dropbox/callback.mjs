// Dropbox stuurt hierheen terug met ?code=… → ruil om voor tokens en bewaar ze.
import { svc, saveTokens, getAccessToken, DBX_KEY, DBX_SECRET, REDIRECT_URI } from "../../lib/dropbox.mjs";

export default async function handler(req, res) {
  try {
    const code = req.query && req.query.code;
    if (!code) { res.status(400).send("Geen autorisatiecode ontvangen."); return; }
    if (!DBX_SECRET) { res.status(500).send("DROPBOX_APP_SECRET ontbreekt in de omgeving."); return; }
    const body = new URLSearchParams({
      code, grant_type: "authorization_code",
      client_id: DBX_KEY, client_secret: DBX_SECRET, redirect_uri: REDIRECT_URI,
    });
    const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const j = await r.json();
    if (j.access_token) {
      await saveTokens(svc(), {
        access_token: j.access_token, refresh_token: j.refresh_token,
        expires_in: j.expires_in || 14400, account: j.account_id || "",
      });
      res.writeHead(302, { Location: "/?dropbox=ok" });
      res.end();
    } else {
      // Dubbele callback-aanroep (code al gebruikt): als er al een geldige koppeling is, gewoon doorsturen.
      try { const tok = await getAccessToken(svc()); if (tok) { res.writeHead(302, { Location: "/?dropbox=ok" }); res.end(); return; } } catch (_) {}
      res.writeHead(302, { Location: "/?dropbox=err" });
      res.end();
    }
  } catch (e) {
    res.status(200).send("Fout bij koppelen: " + String(e.message || e));
  }
}
