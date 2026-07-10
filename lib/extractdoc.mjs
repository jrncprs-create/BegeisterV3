// Haalt platte tekst uit de gangbare documentformaten, zodat de AI ze kan lezen.
// Eén plek voor alle formaten: readfile.mjs en readdrop.mjs gebruiken dit allebei.
//
// Wat er wél kan:
//   pdf   → unpdf
//   docx  → mammoth
//   xlsx / xlsm / xls / csv / tsv → SheetJS
//   pptx  → jszip + de slide-XML uitkleden
//   txt / md / html / json / … → gewoon de tekst
//
// Wat er NIET kan:
//   gdoc / gsheet / gslides → dat zijn geen documenten maar snelkoppelingen naar Google
//                             Drive. De inhoud staat op Google en vereist OAuth.
//   webloc / url            → snelkoppelingen naar een webpagina.

export const TEKST_EXT = ["txt", "md", "markdown", "csv", "tsv", "json", "html", "htm", "xml", "log", "rtf"];
export const SHEET_EXT = ["xlsx", "xlsm", "xlsb", "xls", "ods"];
export const GOOGLE_EXT = ["gdoc", "gsheet", "gslides", "gdraw"];
export const SNELKOPPELING_EXT = ["webloc", "url"];

/** De URL uit een .webloc (XML-plist) of .url (INI). Leeg als er niets in staat. */
export function snelkoppelingUrl(buf) {
  const t = buf.toString("utf8").slice(0, 8000);
  const plist = t.match(/<string>\s*(https?:\/\/[^<\s]+)\s*<\/string>/i);
  if (plist) return plist[1];
  const ini = t.match(/^\s*URL\s*=\s*(\S+)/im);
  if (ini) return ini[1];
  const kaal = t.match(/https?:\/\/[^\s"'<>]+/);
  return kaal ? kaal[0] : "";
}

// Alles wat we uit een bestand kunnen halen zonder externe koppeling.
export const LEESBAAR_EXT = ["pdf", "docx", "pptx", ...SHEET_EXT, ...TEKST_EXT];

export function extVan(naam) {
  return String(naam || "").split(".").pop().toLowerCase();
}

const MAX = 120000;
const knip = (t) => (t.length > MAX ? t.slice(0, MAX) : t);

/** Geeft { tekst, label } of gooit een Error met een leesbare Nederlandse melding. */
export async function extractTekst(buf, naam) {
  const ext = extVan(naam);

  if (GOOGLE_EXT.includes(ext)) {
    // Een .gdoc is een klein JSON-bestand met alleen een verwijzing naar Google Drive.
    let url = "";
    try {
      const j = JSON.parse(buf.toString("utf8"));
      url = j.url || j.doc_url || "";
    } catch (_) {}
    const e = new Error(
      "dit is een Google-snelkoppeling, geen document. De inhoud staat in Google Drive" +
      (url ? " (" + url + ")" : "") + ". Koppel Google om dit te kunnen lezen."
    );
    e.code = "google";
    e.url = url;
    throw e;
  }

  if (SNELKOPPELING_EXT.includes(ext)) {
    // Een .webloc is een XML-plist, een .url een INI-bestandje. Allebei bevatten ze precies
    // één ding: de URL. Die halen we eruit, zodat de app er een klikbare link van kan maken
    // in plaats van een leeg kader.
    const e = new Error("dit is een snelkoppeling naar een webpagina, geen document.");
    e.code = "snelkoppeling";
    e.url = snelkoppelingUrl(buf) || "";
    throw e;
  }

  if (ext === "pdf") {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const ex = await extractText(pdf, { mergePages: true });
    const t = ((ex && ex.text) || "").replace(/[ \t]+\n/g, "\n").trim();
    return { tekst: knip(t), label: "PDF-tekst" };
  }

  if (ext === "docx") {
    const mammoth = (await import("mammoth")).default || (await import("mammoth"));
    const out = await mammoth.extractRawText({ buffer: buf });
    return { tekst: knip(((out && out.value) || "").trim()), label: "Word-tekst" };
  }

  if (SHEET_EXT.includes(ext) || ext === "csv" || ext === "tsv") {
    const XLSX = (await import("xlsx")).default || (await import("xlsx"));
    const wb = XLSX.read(buf, { type: "buffer" });
    const delen = wb.SheetNames.map((naam) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[naam], { blankrows: false });
      return "--- tabblad: " + naam + " ---\n" + csv.trim();
    });
    return { tekst: knip(delen.join("\n\n").trim()), label: "spreadsheet" };
  }

  if (ext === "pptx") {
    const JSZip = (await import("jszip")).default || (await import("jszip"));
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => {
        const n = (s) => parseInt(s.match(/slide(\d+)\.xml/)[1], 10);
        return n(a) - n(b);
      });
    const uit = [];
    for (const p of slides) {
      const xml = await zip.file(p).async("string");
      // <a:t> bevat de tekstruns; de rest is opmaak.
      const stukken = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
      const tekst = stukken.join(" ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      if (tekst) uit.push("--- dia " + (uit.length + 1) + " ---\n" + tekst);
    }
    return { tekst: knip(uit.join("\n\n")), label: "presentatie" };
  }

  if (TEKST_EXT.includes(ext)) {
    return { tekst: knip(buf.toString("utf8")), label: "tekst" };
  }

  const e = new Error("dit bestandstype (." + ext + ") kan ik nog niet lezen.");
  e.code = "onbekend";
  throw e;
}
