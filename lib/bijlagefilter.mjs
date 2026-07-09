// Beslist of een mail-bijlage een echt document is, of alleen behang uit de handtekening.
//
// Waarom dit nodig is: een e-mailhandtekening bevat vaak een logo, een banner en een
// tracking-pixel. Die zitten als "inline" bijlage in de mail en werden allemaal netjes
// opgeslagen. Zo kwam het Begeister-logo (Comp_5.gif, 250 KB) in vijf verschillende
// bronnen terecht.
//
// Grootte is geen bruikbaar signaal — dat logo is groter dan menig echte foto.
// Deze vier signalen samen wél:
//
//   1. inline / cid  — de afbeelding wordt vanuit de HTML-body aangeroepen (mailparser
//                      zet dan `related: true`). Een echte bijlage doet dat nooit.
//   2. naam          — image001.jpg, ABCD1234.png en logo/signature/footer.
//   3. minuscuul     — afbeeldingen onder 8 KB zijn spacers of tracking-pixels.
//   4. herhaling     — hetzelfde bestand (op inhoud-hash) in drie of meer verschillende
//                      bronnen is per definitie geen uniek document. Dit leert zichzelf.
//
// Documenten (pdf, docx, xlsx…) worden NOOIT geweigerd, wat de andere signalen ook zeggen.

import crypto from "crypto";

const BEELD = /^image\//i;
const DOCUMENT_EXT = /\.(pdf|docx?|xlsx?|xlsm|pptx?|csv|tsv|txt|md|rtf|zip|m4a|mp3|wav|mp4|mov)$/i;

// image001.jpg, image23.png — Outlook nummert inline-plaatjes zo.
const NAAM_OUTLOOK = /^image\d{2,4}\.(png|jpe?g|gif|bmp)$/i;
const NAAM_HANDTEKENING = /(^|[-_ ])(logo|signature|handtekening|footer|banner|avatar|icon)([-_ .]|$)/i;

// Camera's en telefoons gebruiken vaste voorvoegsels. DSC01234.jpg is een echte foto,
// geen behang — die mogen we nooit weigeren.
const CAMERA_PREFIX = /^(IMG|DSC|DSCF|DCIM|DJI|GOPR|PXL|MVI|VID|PANO|SAM|P\d{3})/i;

// UD2NVKBV7H.png — willekeurige namen die mailclients aan inline-plaatjes geven:
// precies 10 tekens, hoofdletters én cijfers door elkaar, geen camera-voorvoegsel.
function isWillekeurigeNaam(naam) {
  const m = /^([A-Z0-9]{10})\.(png|jpe?g|gif)$/.exec(naam || "");
  if (!m) return false;
  const stam = m[1];
  if (CAMERA_PREFIX.test(stam)) return false;
  const letters = (stam.match(/[A-Z]/g) || []).length;
  const cijfers = (stam.match(/[0-9]/g) || []).length;
  return letters >= 3 && cijfers >= 2;
}

export const MIN_BEELD_BYTES = 8 * 1024;   // kleiner = spacer of tracking-pixel
export const HERHAAL_DREMPEL = 3;          // in zoveel bronnen gezien = behang

export function hashVan(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function isDocument(naam, mime) {
  if (DOCUMENT_EXT.test(naam || "")) return true;
  if (mime && !BEELD.test(mime)) return true;
  return false;
}

/**
 * @param att  mailparser-bijlage: { filename, contentType, size, content, related, cid, contentDisposition }
 * @param opts { bekendeHashes: Set<string> }  hashes die al ≥3x zijn gezien
 * @returns    { houden: boolean, reden: string }
 */
export function beoordeelBijlage(att, opts = {}) {
  const naam = (att && att.filename) || "";
  const mime = (att && att.contentType) || "";
  const grootte = (att && att.size) || (att && att.content ? att.content.length : 0);

  // Documenten altijd houden. Een pdf in een handtekening bestaat niet.
  if (isDocument(naam, mime)) return { houden: true, reden: "document" };

  // 1. Inline, vanuit de HTML-body aangeroepen.
  if (att && (att.related === true || (att.cid && String(att.contentDisposition || "").toLowerCase() === "inline"))) {
    return { houden: false, reden: "inline afbeelding uit de mailtekst" };
  }

  // 2. Namen die mailclients zelf verzinnen.
  if (NAAM_OUTLOOK.test(naam))      return { houden: false, reden: "genummerde inline-afbeelding" };
  if (isWillekeurigeNaam(naam))     return { houden: false, reden: "willekeurige bestandsnaam" };
  if (NAAM_HANDTEKENING.test(naam)) return { houden: false, reden: "naam wijst op een handtekening" };

  // 3. Te klein om iets voor te stellen.
  if (BEELD.test(mime) && grootte > 0 && grootte < MIN_BEELD_BYTES) {
    return { houden: false, reden: "afbeelding kleiner dan 8 KB" };
  }

  // 4. Al eerder in meerdere bronnen gezien.
  const bekend = opts.bekendeHashes;
  if (bekend && att && att.content) {
    const h = hashVan(att.content);
    if (bekend.has(h)) return { houden: false, reden: "komt in meerdere mails identiek terug" };
  }

  return { houden: true, reden: "" };
}
