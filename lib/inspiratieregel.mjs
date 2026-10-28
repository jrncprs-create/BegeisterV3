// Herkent of een binnengekomen bericht inspiratie is in plaats van werk.
// Gedeeld door de intake-ingangen (WhatsApp, iOS-Opdracht).
//
// Inspiratie als:
//  - de tekst een Instagram-link bevat (die is altijd inspiratie), of
//  - er een los woord in staat dat met "insp" begint (insp, inspo, inspiratie, ...).
// Wat er na weghalen van links en het trefwoord overblijft, wordt het thema.

export const INSP_RE = /(^|[\s#@.,;:!?])insp\w*/i;
export const INSTA_RE = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s<>()"']+/i;
const URL_RE = /https?:\/\/[^\s<>()"']+/i;

export function isInspiratie(tekst) {
  const t = String(tekst || "");
  return INSP_RE.test(t) || INSTA_RE.test(t);
}

// Eerste Instagram-link, anders de eerste gewone link, anders "".
export function inspiratieLink(tekst) {
  const t = String(tekst || "");
  return (t.match(INSTA_RE) || t.match(URL_RE) || [])[0] || "";
}

// Losse woorden naast de link en het trefwoord: die worden het thema (de map in Inspiratie).
export function inspiratieThema(tekst) {
  let rest = String(tekst || "")
    .replace(/https?:\/\/[^\s<>()"']+/ig, " ")
    .replace(/(^|[\s#@.,;:!?])insp\w*/ig, " ")
    .replace(/[#@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (rest) rest = rest.charAt(0).toUpperCase() + rest.slice(1);
  return rest;
}
