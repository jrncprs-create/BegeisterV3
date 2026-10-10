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

test("ics: één hele-dag-event per boeking, met link en herinnering 4 uur vooraf", () => {
  const d = boekingNaarDagen({ platform: "airbnb", gast: "Lucas & Rachel", gasten: 2, aankomst: "2026-10-19", vertrek: "2026-10-23", code: "HMZ5QNNTBH", url: "https://www.airbnb.nl/hosting/reservations/details/HMZ5QNNTBH" });
  const ics = icsVanDagen(d, "airbnb", "Verhuur Airbnb");
  assert.match(ics, /SUMMARY:Airbnb · Lucas & Rachel \(2\)/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261019/);
  assert.match(ics, /DTEND;VALUE=DATE:20261023/);
  assert.match(ics, /TRIGGER;VALUE=DATE-TIME:20261019T100000Z/);  // 12:00 zomertijd = 4 uur voor aankomst
  assert.match(ics, /URL:https:\/\/www\.airbnb\.nl/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal(icsVanDagen(d, "booking", "x").includes("VEVENT"), false);
});

test("middagUtc: 12:00 Amsterdam in zomer- en wintertijd", async () => {
  const { middagUtc } = await import("./loft-agenda.mjs");
  assert.equal(middagUtc("2026-10-19"), "20261019T100000Z");
  assert.equal(middagUtc("2026-11-02"), "20261102T110000Z");
});

test("schoonmaak: wissel tot 16:00, anders tot 14:00 met volgende aankomst", async () => {
  const { schoonmaak, icsSchoonmaak } = await import("./loft-agenda.mjs");
  const a = boekingNaarDagen({ platform: "airbnb", gast: "Amy", aankomst: "2026-10-09", vertrek: "2026-10-11", code: "A" });
  const b = boekingNaarDagen({ platform: "airbnb", gast: "Samuel", aankomst: "2026-10-11", vertrek: "2026-10-15", code: "B" });
  const c = boekingNaarDagen({ platform: "booking", gast: "Mark", aankomst: "2026-10-19", vertrek: "2026-10-21", code: "C" });
  const s = schoonmaak([...a, ...b, ...c]);
  assert.deepEqual(s.map(x => [x.datum, x.tot, x.wissel]), [["2026-10-11", "16:00", true], ["2026-10-15", "14:00", false], ["2026-10-21", "14:00", false]]);
  assert.equal(s[1].volgende.gast, "Mark");
  assert.equal(s[2].volgende, null);
  const ics = icsSchoonmaak([...a, ...b, ...c]);
  assert.match(ics, /SUMMARY:Schoonmaken · wissel: Samuel komt 16:00/);
  assert.equal(ics.includes("VALARM"), false);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
});
