// node --test lib/loft-mail.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mailConfig, verstuurMail } from "./loft-mail.mjs";

test("ontbrekende variabelen geven een luide fout", () => {
  assert.throws(() => mailConfig({}), /LOFT_MAIL_USER en LOFT_MAIL_PASS/);
  assert.throws(() => mailConfig({ LOFT_MAIL_USER: "x" }), /LOFT_MAIL_PASS/);
  assert.equal(mailConfig({ LOFT_MAIL_USER: "a@b.nl", LOFT_MAIL_PASS: "p" }).from, "a@b.nl");
});

test("verstuurMail zet reply-koppen en geeft het id terug", async () => {
  process.env.LOFT_MAIL_USER = "a@b.nl"; process.env.LOFT_MAIL_PASS = "p"; process.env.LOFT_MAIL_FROM = "jeroen@cprs.nl";
  let gezien;
  const nep = { sendMail: async (m) => { gezien = m; return { messageId: "<123@test>" }; } };
  const r = await verstuurMail({ aan: "gast@reply.airbnb.com", onderwerp: "Re: vraag", tekst: "Hi", inReplyTo: "<abc@airbnb>" }, nep);
  assert.equal(r.id, "<123@test>");
  assert.equal(gezien.from, "jeroen@cprs.nl");
  assert.equal(gezien.inReplyTo, "<abc@airbnb>");
  const stil = { sendMail: async () => ({}) };
  await assert.rejects(() => verstuurMail({ aan: "x", onderwerp: "y", tekst: "z" }, stil), /geen messageId/);
});
