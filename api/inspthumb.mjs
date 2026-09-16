// Bewaart de preview van een link als eigen bestand, zodat het inspiratiebord niet
// zwart wordt zodra Instagram zijn ondertekende CDN-url laat verlopen.
//
// POST { url }                → haalt og:image op, bewaart 'm, geeft { storage_path, title, video }
// POST { url, id }            → doet hetzelfde en zet het pad meteen op dat insp_items-record
// POST { url, alles:true }    → bewaart ook de losse frames van een carrousel
// POST { backfill:true }      → loopt bestaande insp_items na die nog aan een CDN-url hangen
import { svc } from "../lib/usage.mjs";
import { haalMeta, bewaarBeeld } from "../lib/linkbeeld.mjs";

const BUCKET = "intake";
const BACKFILL_MAX = 25;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const db = svc();
  if (!db) return res.status(200).json({ error: "geen database" });

  const { url = "", id = "", alles = false, backfill = false } = req.body || {};

  try {
    if (backfill) return res.status(200).json(await doeBackfill(db));

    if (!/^https?:\/\//i.test(String(url))) return res.status(400).json({ error: "geen geldige url" });

    const meta = await haalMeta(url);
    if (!meta.image) return res.status(200).json({ error: "geen afbeelding op deze pagina gevonden", title: meta.title || "" });

    const storage_path = await bewaarBeeld(db, meta.image, BUCKET);
    if (!storage_path) return res.status(200).json({ error: "kon de afbeelding niet bewaren", title: meta.title || "" });

    let paden = [storage_path];
    if (alles && meta.images && meta.images.length > 1) {
      for (const im of meta.images.slice(1, 6)) {
        const p = await bewaarBeeld(db, im, BUCKET);
        if (p) paden.push(p);
      }
    }

    if (id) {
      await db.from("insp_items").update({
        storage_path, type: "image", thumb: null,
        images: paden.length > 1 ? paden : null,
        title: meta.title || undefined,
      }).eq("id", id);
    }

    return res.status(200).json({ storage_path, paden, title: meta.title || "", video: meta.video || "" });
  } catch (e) {
    console.error("inspthumb", e && e.message);
    return res.status(200).json({ error: "kon de preview niet ophalen" });
  }
}

// Alles wat nog een verlopende CDN-thumb heeft, maar wél een echte bron-url: opnieuw ophalen.
async function doeBackfill(db) {
  const { data: rijen } = await db
    .from("insp_items")
    .select("id, url, thumb, storage_path")
    .is("storage_path", null)
    .not("url", "is", null)
    .limit(BACKFILL_MAX);

  if (!rijen || !rijen.length) return { gedaan: 0, mislukt: 0, over: 0 };

  let gedaan = 0, mislukt = 0;
  for (const r of rijen) {
    try {
      const meta = await haalMeta(r.url);
      const pad = meta.image ? await bewaarBeeld(db, meta.image, BUCKET) : null;
      if (!pad) { mislukt++; continue; }
      await db.from("insp_items").update({ storage_path: pad, type: "image", thumb: null }).eq("id", r.id);
      gedaan++;
    } catch (_) { mislukt++; }
  }

  const { count } = await db
    .from("insp_items").select("id", { count: "exact", head: true })
    .is("storage_path", null).not("url", "is", null);

  return { gedaan, mislukt, over: count || 0 };
}
