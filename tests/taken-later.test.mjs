// Draai met: node --test tests/taken-later.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Het bestand is een gewoon browserscript: het zet TakenLater op globalThis.
await import('../public/taken-later.js');
const { splitsLater, dagenTot } = globalThis.TakenLater;

const V = '2026-10-27';

test('dagenTot telt kalenderdagen', () => {
  assert.equal(dagenTot('2026-10-28', V), 1);
  assert.equal(dagenTot('2026-11-03', V), 7);
  assert.equal(dagenTot('2026-10-22', V), -5);
});

test('binnen 7 dagen, te laat en zonder datum blijven bij nu', () => {
  const r = splitsLater([
    { id: 'a', status: 'todo', due: '2026-10-28' },
    { id: 'b', status: 'todo', due: '2026-11-03' },
    { id: 'c', status: 'todo', due: '2026-10-22' },
    { id: 'd', status: 'todo', due: null },
  ], V);
  assert.deepEqual(r.nu.map(x => x.id), ['a', 'b', 'c', 'd']);
  assert.equal(r.later.length, 0);
});

test('verder dan 7 dagen gaat naar later', () => {
  const r = splitsLater([
    { id: 'a', status: 'todo', due: '2026-11-04' },
    { id: 'b', status: 'doing', due: '2026-12-23' },
  ], V);
  assert.deepEqual(r.later.map(x => x.id), ['a', 'b']);
});

test('afgevinkt blijft bij nu, ook met verre datum', () => {
  const r = splitsLater([{ id: 'a', status: 'done', due: '2026-12-01' }], V);
  assert.deepEqual(r.nu.map(x => x.id), ['a']);
});

test('opstartplanning op 27 okt: 10 nu, 40 later', () => {
  const dagen = ['2026-10-28','2026-10-28','2026-10-28','2026-10-28','2026-10-29','2026-10-29',
    '2026-11-02','2026-11-02','2026-11-03','2026-11-03'];
  const items = dagen.map((d, i) => ({ id: 'n' + i, status: 'todo', due: d }))
    .concat(Array.from({ length: 40 }, (_, i) => ({ id: 'l' + i, status: 'todo', due: '2026-11-04' })));
  const r = splitsLater(items, V);
  assert.equal(r.nu.length, 10);
  assert.equal(r.later.length, 40);
});
