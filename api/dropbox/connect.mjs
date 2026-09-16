// Start de Dropbox OAuth-flow: stuur de gebruiker naar het toestemmingsscherm.
import { DBX_KEY, REDIRECT_URI, SCOPES } from "../../lib/dropbox.mjs";

export default function handler(req, res) {
  if (!DBX_KEY) { res.status(500).send("DROPBOX_APP_KEY ontbreekt in de omgeving."); return; }
  const u = new URL("https://www.dropbox.com/oauth2/authorize");
  u.searchParams.set("client_id", DBX_KEY);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("token_access_type", "offline");
  u.searchParams.set("scope", SCOPES);
  res.writeHead(302, { Location: u.toString() });
  res.end();
}
