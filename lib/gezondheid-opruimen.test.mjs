// node --test lib/gezondheid-opruimen.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { beslisFiles, beslisDocumenten, archiveer } from "./gezondheid-opruimen.mjs";

test("wezen en oudere duplicaten gaan in het archief, nieuwste blijft", () => {
  const files = [
    { id: "a", owner_type: "project", owner_id: "p1", name: "Plan.pdf", created_at: "2026-01-01" },
    { id: "b", owner_type: "project", owner_id: "p1", name: "plan.PDF", created_at: "2026-03-01" },
    { id: "c", owner_type: "project", owner_id: "weg", name: "x.pdf" },
    { id: "d", owner_type: "task", owner_id: "t9", name: "y.png" },
    { id: "e", owner_type: "client", owner_id: "k1", name: "z.png" },
    { id: "f", owner_type: "project", owner_id: "p1", name: "oud.pdf", archived_at: "2026-02-01" },
  ];
  const uit = beslisFiles(files, new Set(["p1"]), new Set(["t1"]));
  assert.deepEqual(uit.map(x => x.id).sort(), ["a", "c", "d"]);
  assert.match(uit.find(x => x.id === "a").reden, /dubbel/);
  assert.match(uit.find(x => x.id === "c").reden, /project/);
  assert.match(uit.find(x => x.id === "d").reden, /taak/);
});

test("documenten: kopieën van files-rijen tellen niet mee", () => {
  const docs = [
    { id: "1", project_id: "p1", filename: "a.docx", created_at: "2026-01-01" },
    { id: "2", project_id: "p1", filename: "a.docx", created_at: "2026-02-01" },
    { id: "3", project_id: "p1", filename: "a.docx", origin: "file" },
    { id: "4", project_id: "weg", filename: "b.docx" },
  ];
  const uit = beslisDocumenten(docs, new Set(["p1"]));
  assert.deepEqual(uit.map(x => x.id).sort(), ["1", "4"]);
});

test("archiveer schrijft archived_at en reden, en faalt luid", async () => {
  const geschreven = [];
  const db = { from: t => ({ update: v => ({ eq: async (_k, id) => { geschreven.push([t, id, v.archief_reden]); return { error: null }; } }) }) };
  assert.equal(await archiveer(db, "files", [{ id: "a", reden: "dubbel" }]), 1);
  assert.equal(geschreven[0][2], "dubbel");
  const kapot = { from: () => ({ update: () => ({ eq: async () => ({ error: { message: "rls" } }) }) }) };
  await assert.rejects(() => archiveer(kapot, "files", [{ id: "a", reden: "x" }]), /archiveren: rls/);
});
