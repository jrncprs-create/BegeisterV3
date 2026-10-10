// Mail versturen voor de Loft-tab (antwoord aan een gast). Gmail-SMTP met app-wachtwoord.
// Railway-variabelen: LOFT_MAIL_USER (Gmail-account), LOFT_MAIL_PASS (app-wachtwoord), LOFT_MAIL_FROM (afzender, bv. jeroen@cprs.nl).
// Ontbreekt er een, dan een luide fout; er wordt dan niets verstuurd.
import nodemailer from "nodemailer";

export function mailConfig(env = process.env) {
  const user = (env.LOFT_MAIL_USER || "").trim(), pass = (env.LOFT_MAIL_PASS || "").trim(), from = (env.LOFT_MAIL_FROM || user).trim();
  const mist = [!user && "LOFT_MAIL_USER", !pass && "LOFT_MAIL_PASS"].filter(Boolean);
  if (mist.length) throw new Error("mail niet ingesteld: zet " + mist.join(" en ") + " in Railway");
  return { user, pass, from };
}

export async function verstuurMail({ aan, onderwerp, tekst, inReplyTo }, transport) {
  const cfg = mailConfig();
  const t = transport || nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: cfg.user, pass: cfg.pass } });
  const bericht = { from: cfg.from, to: aan, subject: onderwerp, text: tekst };
  if (inReplyTo) { bericht.inReplyTo = inReplyTo; bericht.references = inReplyTo; }
  const r = await t.sendMail(bericht);
  if (!r || !r.messageId) throw new Error("mail niet verstuurd: geen messageId terug");
  return { id: r.messageId };
}
