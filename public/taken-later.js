// Taken-kolom: splitst open taken in "nu" (geen datum, te laat of binnen het venster)
// en "later" (deadline verder weg). Afgevinkte taken blijven bij "nu" staan.
// Los bestand naast index.html; ook in Node te testen (tests/taken-later.test.mjs).
(function(root){
  'use strict';
  const VENSTER_DAGEN = 7;
  function dagenTot(isoDatum, vandaagIso){
    const a = Date.UTC(+isoDatum.slice(0,4), +isoDatum.slice(5,7)-1, +isoDatum.slice(8,10));
    const b = Date.UTC(+vandaagIso.slice(0,4), +vandaagIso.slice(5,7)-1, +vandaagIso.slice(8,10));
    return Math.round((a-b)/86400000);
  }
  function splitsLater(items, vandaagIso, venster){
    const grens = venster == null ? VENSTER_DAGEN : venster;
    const nu = [], later = [];
    (items||[]).forEach(it=>{
      const isLater = it.status!=='done' && it.due && dagenTot(String(it.due).slice(0,10), vandaagIso) > grens;
      (isLater ? later : nu).push(it);
    });
    return { nu, later };
  }
  const api = { splitsLater, dagenTot, VENSTER_DAGEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TakenLater = api;
})(typeof window !== 'undefined' ? window : globalThis);
