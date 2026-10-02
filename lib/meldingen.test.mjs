// node --test lib/meldingen.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { verstuurOpen } from "./meldingen.mjs";

// Nep-Supabase met precies de ketens die meldingen.mjs gebruikt.
function nepDb(rijen) {
  const db = {
    rijen,
    from() {
      const q = { _update: null, _id: null };
      q.select = () => q;
      q.is = () => q;
      q.order = () => q;
      q.limit = async () => ({ data: db.rijen.filter(r => !r.verzonden_op), error: null });
      q.update = (v) => { q._update = v; return q; };
      q.eq = async (_k, id) => { Object.assign(db.rijen.find(r => r.id === id), q._update); return { error: null }; };
      return q;
    },
  };
  return db;
}

test("pusht open meldingen één keer naar de juiste persoon", async () => {
  const db = nepDb([{ id: 1, aan: "Jeroen", titel: "Alarm", tekst: "tegoed", url: "/" },
                    { id: 2, aan: "Jeroen", titel: "Oud", tekst: "x", verzonden_op: "2026-10-01" }]);
  const gestuurd = [];
  const uit = await verstuurOpen(db, async (_db, p, wie) => { gestuurd.push([p.title, wie]); return { sent: 3 }; });
  assert.deepEqual(gestuurd, [["Alarm", ["Jeroen"]]]);
  assert.equal(uit[0].resultaat, "3 apparaten");
  assert.ok(db.rijen[0].verzonden_op);
  assert.deepEqual(await verstuurOpen(db, async () => { throw new Error("niet nog eens"); }), []);
});

test("een fout bij het pushen komt in resultaat, de rest gaat door", async () => {
  const db = nepDb([{ id: 1, aan: "Jeroen", titel: "a", tekst: "a" }, { id: 2, aan: "Marlon", titel: "b", tekst: "b" }]);
  const uit = await verstuurOpen(db, async (_db, _p, wie) => {
    if (wie[0] === "Jeroen") throw new Error("push stuk");
    return { sent: 0 };
  });
  assert.equal(uit[0].resultaat, "fout: push stuk");
  assert.equal(uit[1].resultaat, "0 apparaten");
});
