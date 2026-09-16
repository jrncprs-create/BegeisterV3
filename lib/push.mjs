// Webpush helper — stuurt notificaties naar alle opgeslagen abonnementen.
import webpush from "web-push";

// Sleutels staan hier als config (privé-repo). Env-vars overschrijven indien aanwezig.
const PUB = (process.env.VAPID_PUBLIC_KEY || "BFD467bSbNKmU9lhok7tTlkRMt_QpM-d-_Nn4_R1Z86-F5I5NkvB3Bj0xSBMz-HkHFYHdupnActbSp4_3J7uJlg").trim();
const PRIV = (process.env.VAPID_PRIVATE_KEY || "XNKuBi5cFSQ7Bk-4KZwUbi2w0Mvr2WOCSkutuFBhBqw").trim();
const SUBJ = (process.env.VAPID_SUBJECT || "mailto:jeroen@begeister.nl").trim();

let ready = false;
function init() {
  if (ready) return true;
  if (PUB && PRIV) { webpush.setVapidDetails(SUBJ, PUB, PRIV); ready = true; }
  return ready;
}

// db = Supabase service-client. payload = {title, body, url}
export async function sendToAll(db, payload, excludeWho) {
  if (!init()) return { sent: 0, error: "no-vapid-keys" };
  const { data: subs } = await db.from("push_subs").select("*");
  let list = subs || [];
  if (excludeWho) list = list.filter(s => (s.who || "") !== excludeWho);
  let sent = 0; const dead = [];
  for (const s of list) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint);
    }
  }
  if (dead.length) await db.from("push_subs").delete().in("endpoint", dead);
  return { sent, removed: dead.length };
}

// Stuurt alleen naar de opgegeven persoon/personen (bv. bij een @mention).
// whoList = string of array van 'who'-waarden (bv. ["Marlon"]).
export async function sendToWho(db, payload, whoList) {
  if (!init()) return { sent: 0, error: "no-vapid-keys" };
  const wants = (Array.isArray(whoList) ? whoList : [whoList])
    .map(w => String(w || "").trim().toLowerCase()).filter(Boolean);
  if (!wants.length) return { sent: 0 };
  const { data: subs } = await db.from("push_subs").select("*");
  const list = (subs || []).filter(s => wants.includes(String(s.who || "").trim().toLowerCase()));
  let sent = 0; const dead = [];
  for (const s of list) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint);
    }
  }
  if (dead.length) await db.from("push_subs").delete().in("endpoint", dead);
  return { sent, removed: dead.length };
}
