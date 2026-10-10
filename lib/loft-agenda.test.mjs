// node --test lib/loft-agenda.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { airbnbBasis, boekingNaarDagen, wissels, gastprijsVoor, isWeekendNacht, icsVanDagen } from "./loft-agenda.mjs";

test("Airbnb-basisprijs: gast betaalt 124 bij basis 110", () => {
  assert.equal(airbnbBasis(124), 110);
  assert.throws(() => airbnbBasis(0));
});

test("boeking wordt rij per nacht, vertrekdag niet", () => {
  const d = boekingNaarDagen({ platform: "airbnb", gast: "Samuel", gasten: 2, aankomst: "2026-10-11", vertrek: "2026-10-15", code: "HM2ZHXF8A2" });
  assert.deepEqual(d.map(x => x.datum), ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]);
  assert.equal(d[0].aankomst, true);
  assert.equal(d[1].aankomst, false);
  assert.throws(() => boekingNaarDagen({ platform: "airbnb", aankomst: "2026-10-15", vertrek: "2026-10-11" }));
});

test("wissel: vertrek en aankomst op dezelfde dag, verschillende code", () => {
  const a = boekingNaarDagen({ platform: "airbnb", gast: "Amy", aankomst: "2026-10-09", vertrek: "2026-10-11", code: "A" });
  const b = boekingNaarDagen({ platform: "booking", gast: "Samuel", aankomst: "2026-10-11", vertrek: "2026-10-15", code: "B" });
  const w = wissels([...a, ...b]);
  assert.equal(w.length, 1);
  assert.equal(w[0].datum, "2026-10-11");
  assert.equal(w[0].weg.gast, "Amy");
  assert.equal(w[0].komt.platform, "booking");
  // Zelfde boeking die doorloopt is geen wissel
  assert.equal(wissels(b).length, 0);
});

test("weekend is vrijdag- en zaterdagnacht; prijs binnen grenzen", () => {
  assert.equal(isWeekendNacht("2026-10-16"), true);   // vrijdag
  assert.equal(isWeekendNacht("2026-10-18"), false);  // zondag
  const inst = { weekdag: 124, weekend: 160, minimum: 99, maximum: 150 };
  assert.equal(gastprijsVoor("2026-10-14", inst), 124);
  assert.equal(gastprijsVoor("2026-10-16", inst), 150);
  assert.throws(() => gastprijsVoor("2026-10-14", {}));
});

test("ics: één event per boeking, 16:00 tot 12:00, met link", () => {
  const d = boekingNaarDagen({ platform: "airbnb", gast: "Lucas & Rachel", gasten: 2, aankomst: "2026-10-19", vertrek: "2026-10-23", code: "HMZ5QNNTBH", url: "https://www.airbnb.nl/hosting/reservations/details/HMZ5QNNTBH" });
  const ics = icsVanDagen(d, "airbnb", "Verhuur Airbnb");
  assert.match(ics, /SUMMARY:Airbnb · Lucas & Rachel \(2\)/);
  assert.match(ics, /DTSTART;TZID=Europe\/Amsterdam:20261019T160000/);
  assert.match(ics, /DTEND;TZID=Europe\/Amsterdam:20261023T120000/);
  assert.match(ics, /URL:https:\/\/www\.airbnb\.nl/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal(icsVanDagen(d, "booking", "x").includes("VEVENT"), false);
});
