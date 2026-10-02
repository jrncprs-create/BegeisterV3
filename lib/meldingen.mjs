// Losse pushmeldingen van buitenaf (2-10-2026, kostenalarm telefooncel).
// Iets buiten de app (een geplande taak via de Supabase-koppeling) zet een regel in de
// tabel `meldingen`; de server kijkt elke minuut en pusht wat openstaat naar `aan`.
// Een melding gaat één keer: na de poging staat verzonden_op erop, met het resultaat.
// Niemand geabonneerd = luid in `resultaat` ("0 apparaten"), niet stil weggegooid.
import { sendToWho } from "./push.mjs";

const MAX_PER_RONDE = 10;   // tegen een volgelopen tabel die alles tegelijk pusht

// stuur = (db, payload, wie) -> {sent, removed?, error?}; los te vervangen in de test.
export async function verstuurOpen(db, stuur = sendToWho) {
  const { data, error } = await db.from("meldingen")
    .select("id, aan, titel, tekst, url")
    .is("verzonden_op", null)
    .order("aangemaakt", { ascending: true })
    .limit(MAX_PER_RONDE);
  if (error) throw new Error("meldingen lezen: " + error.message);
  const uitslag = [];
  for (const m of data || []) {
    let resultaat;
    try {
      const r = await stuur(db, { title: String(m.titel).slice(0, 80), body: String(m.tekst).slice(0, 300), url: m.url || "/" }, [m.aan]);
      resultaat = r.error ? "fout: " + r.error : r.sent + " apparaten";
    } catch (e) {
      resultaat = "fout: " + String((e && e.message) || e);
    }
    const { error: fout } = await db.from("meldingen")
      .update({ verzonden_op: new Date().toISOString(), resultaat })
      .eq("id", m.id);
    if (fout) throw new Error("melding " + m.id + " bijwerken: " + fout.message);
    uitslag.push({ id: m.id, resultaat });
  }
  return uitslag;
}
