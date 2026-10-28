// Draai met: node --test tests/inspiratieregel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isInspiratie, inspiratieLink, inspiratieThema } from "../lib/inspiratieregel.mjs";

const INSTA = "https://www.instagram.com/p/DdmTqboB-LG/?stkn=M3hkcmU1cTNsOXp6";

test("Instagram-link is altijd inspiratie", () => {
  assert.equal(isInspiratie(INSTA), true);
  assert.equal(isInspiratie("kijk " + INSTA), true);
});

test("trefwoord insp maakt een gewone link inspiratie", () => {
  assert.equal(isInspiratie("inspo https://example.com/lamp"), true);
  assert.equal(isInspiratie("#inspiratie neon"), true);
});

test("gewoon werkbericht is geen inspiratie", () => {
  assert.equal(isInspiratie("Offerte Ostrica voor vrijdag sturen"), false);
  assert.equal(isInspiratie("https://example.com/factuur.pdf"), false);
  assert.equal(isInspiratie(""), false);
});

test("link: Instagram gaat voor, anders eerste link", () => {
  assert.equal(inspiratieLink("insp https://a.nl/x " + INSTA), INSTA);
  assert.equal(inspiratieLink("insp https://a.nl/x"), "https://a.nl/x");
  assert.equal(inspiratieLink("insp zonder link"), "");
});

test("thema is wat overblijft, met hoofdletter", () => {
  assert.equal(inspiratieThema("insp lichtkunst " + INSTA), "Lichtkunst");
  assert.equal(inspiratieThema(INSTA), "");
  assert.equal(inspiratieThema("#inspo open calls"), "Open calls");
});
