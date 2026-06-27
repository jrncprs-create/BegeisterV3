// Dropbox OAuth + API-helpers (server-side). Tokens staan in Supabase (RLS aan → alleen service-role).
import { createClient } from "@supabase/supabase-js";

const KEY = (process.env.DROPBOX_APP_KEY || "").trim();
const SECRET = (process.env.DROPBOX_APP_SECRET || "").trim();
export const REDIRECT_URI = (process.env.DROPBOX_REDIRECT_URI || "https://begeister-app.vercel.app/api/dropbox/callback").trim();
export const SCOPES = "account_info.read files.metadata.read files.content.read files.content.write sharing.write sharing.read file_requests.write";

export function svc() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function saveTokens(db, { access_token, refresh_token, expires_in, account }) {
  const row = {
    id: 1,
    access_token,
    expires_at: new Date(Date.now() + ((expires_in || 14400) - 90) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (refresh_token) row.refresh_token = refresh_token;
  if (account) row.account = account;
  await db.from("dropbox_auth").upsert(row, { onConflict: "id" });
}

// Geldig access-token ophalen; ververst automatisch met de refresh-token.
export async function getAccessToken(db) {
  const { data: a } = await db.from("dropbox_auth").select("*").eq("id", 1).maybeSingle();
  if (!a || !a.refresh_token) return null;
  if (a.access_token && a.expires_at && new Date(a.expires_at) > new Date()) return a.access_token;
  const body = new URLSearchParams({
    grant_type: "refresh_token", refresh_token: a.refresh_token, client_id: KEY, client_secret: SECRET,
  });
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const j = await r.json();
  if (!j.access_token) return null;
  await saveTokens(db, { access_token: j.access_token, expires_in: j.expires_in || 14400 });
  return j.access_token;
}

export const DBX_KEY = KEY, DBX_SECRET = SECRET;
