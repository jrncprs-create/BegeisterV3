// Synchroniseert bijlagen naar Dropbox.
//
// De afspraak (met Jeroen, 9 juli):
//   • Kleine bestanden (< 2 MB) gaan direct mee bij binnenkomst. Dat zijn documenten,
//     bonnen en gecomprimeerde foto's — de intake merkt er niets van.
//   • Grote bestanden komen in `dropbox_wachtrij` en worden elk uur in kleine porties
//     afgewerkt. Zo vertraagt één mail met tien foto's van 5 MB de intake niet.
//
// Waarom een wachtrij en geen "gewoon alles meteen": de mail-poller draait in dezelfde
// timer als de rest van de intake. Een upload van 6 MB kan tientallen seconden duren.
// Tien daarvan achter elkaar en de poller loopt in zijn eigen staart.

export const DIRECT_DREMPEL = 2 * 1024 * 1024;   // 2 MB
export const PORTIE = 6;                          // per uurlijkse ronde
export const MAX_POGINGEN = 3;

/** Beslist of dit bestand meteen mee mag, of moet wachten. */
export function magDirect(size) {
  const n = Number(size) || 0;
  return n > 0 && n < DIRECT_DREMPEL;
}

/** /Klant/Project/Map — de indeling die de Bestanden-pagina ook gebruikt. */
export function doelPad(klant, project, map) {
  const veilig = (s) => String(s || "").replace(/[\/\\:*?"<>|]/g, "-").trim() || "Overig";
  return "/" + [veilig(klant), veilig(project || "Algemeen"), veilig(map || "Overig")].join("/");
}

/**
 * Zet elk nog niet gesynchroniseerd document in de wachtrij.
 *
 * Eerst sloeg deze functie kleine bestanden over, want "die gaan al direct mee bij
 * binnenkomst". Dat gold alleen voor post die ná die wijziging binnenkwam. Alles wat er
 * al stond viel tussen wal en schip: te klein voor de wachtrij, te oud voor de directe
 * route. Vandaar: de grootte bepaalt alleen nog hoe snel iets aan de beurt is, niet óf.
 *
 * Bestanden met een `dropbox:`-pad staan al in Dropbox — dat is hun herkomst, geen doel.
 * Ze vallen hier af; anders proberen we ze uit Storage te halen waar ze nooit stonden.
 */
export async function vulWachtrij(db) {
  const { data: docs } = await db
    .from("documents")
    .select("id, filename, storage_path, size, category, project_id, projects(client, project)")
    .is("dropbox_gesynct_op", null)
    .not("storage_path", "is", null)
    .limit(200);

  if (!docs || !docs.length) return 0;

  const { data: bestaand } = await db
    .from("dropbox_wachtrij").select("document_id").not("document_id", "is", null);
  const alIn = new Set((bestaand || []).map((r) => r.document_id));

  const nieuw = docs
    .filter((d) => !alIn.has(d.id) && !String(d.storage_path).startsWith("dropbox:"))
    .map((d) => ({
      document_id: d.id,
      storage_path: d.storage_path,
      filename: d.filename,
      size: d.size,
      doel: doelPad(d.projects?.client, d.projects?.project, d.category),
    }));

  if (!nieuw.length) return 0;
  await db.from("dropbox_wachtrij").insert(nieuw);
  return nieuw.length;
}

/**
 * Werkt één portie van de wachtrij af.
 * @param db        Supabase-client (service role)
 * @param uploader  async ({buffer, filename, doel}) => {link} — de echte Dropbox-upload
 * @param bucket    naam van de Storage-bucket
 */
export async function werkWachtrijAf(db, uploader, bucket = "intake") {
  const { data: rijen } = await db
    .from("dropbox_wachtrij")
    .select("*")
    .in("status", ["wacht", "mislukt"])
    .lt("pogingen", MAX_POGINGEN)
    .order("aangemaakt", { ascending: true })
    .limit(PORTIE);

  if (!rijen || !rijen.length) return { gedaan: 0, mislukt: 0, over: 0 };

  let gedaan = 0, mislukt = 0;

  for (const r of rijen) {
    await db.from("dropbox_wachtrij").update({ status: "bezig", pogingen: r.pogingen + 1 }).eq("id", r.id);
    try {
      const dl = await db.storage.from(bucket).download(r.storage_path);
      if (dl.error || !dl.data) throw new Error("kon het bestand niet uit Storage halen");
      const buffer = Buffer.from(await dl.data.arrayBuffer());

      const uit = await uploader({ buffer, filename: r.filename, doel: r.doel });
      if (!uit || !uit.link) throw new Error("Dropbox gaf geen link terug");

      await db.from("dropbox_wachtrij").update({ status: "klaar", afgerond: new Date(), fout: null }).eq("id", r.id);
      if (r.document_id) {
        await db.from("documents")
          .update({ dropbox_path: uit.link, dropbox_gesynct_op: new Date() })
          .eq("id", r.document_id);
      }
      gedaan++;
    } catch (e) {
      const bericht = (e && e.message) || "onbekende fout";
      const opgegeven = (r.pogingen + 1) >= MAX_POGINGEN;
      await db.from("dropbox_wachtrij")
        .update({ status: "mislukt", fout: bericht.slice(0, 300) })
        .eq("id", r.id);
      console.error(`dropbox-wachtrij: ${r.filename} mislukt (poging ${r.pogingen + 1}${opgegeven ? ", opgegeven" : ""}): ${bericht}`);
      mislukt++;
    }
  }

  const { count } = await db
    .from("dropbox_wachtrij")
    .select("id", { count: "exact", head: true })
    .in("status", ["wacht", "mislukt"])
    .lt("pogingen", MAX_POGINGEN);

  return { gedaan, mislukt, over: count || 0 };
}
