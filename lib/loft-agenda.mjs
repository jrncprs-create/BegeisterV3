// Loft Spinozastraat: pure rekenlogica voor de verhuur-agenda. Geen database, geen netwerk.
// Test: node --test lib/loft-agenda.test.mjs

export const AIRBNB_BELASTING = 0.125;   // Airbnb zet 12,5% toeristenbelasting bovenop de hostprijs

// Wat de host op Airbnb instelt zodat de gast `gastprijs` betaalt. Booking krijgt de gastprijs zelf.
export function airbnbBasis(gastprijs) {
  if (!(gastprijs > 0)) throw new Error("gastprijs moet groter dan 0 zijn");
  return Math.round(gastprijs / (1 + AIRBNB_BELASTING));
}

// "2026-10-11" -> Date (lokale middag, zodat tijdzones de datum niet verschuiven)
export function dag(iso) {
  const [j, m, d] = String(iso).split("-").map(Number);
  if (!j || !m || !d) throw new Error("ongeldige datum: " + iso);
  return new Date(j, m - 1, d, 12);
}
export function isoVan(date) {
  const p = n => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + p(date.getMonth() + 1) + "-" + p(date.getDate());
}

// Een boeking {platform, gast, gasten, aankomst, vertrek (iso), code, url} wordt een rij per nacht.
// De vertrekdag zelf is geen nacht; die krijgt wel `vertrek:true` zodat een wissel zichtbaar is.
export function boekingNaarDagen(b) {
  if (!b.aankomst || !b.vertrek) throw new Error("boeking zonder aankomst of vertrek: " + JSON.stringify(b));
  const uit = [];
  const d = dag(b.aankomst), eind = dag(b.vertrek);
  if (!(d < eind)) throw new Error("vertrek ligt niet na aankomst: " + b.aankomst + " / " + b.vertrek);
  for (let t = new Date(d); t < eind; t.setDate(t.getDate() + 1)) {
    uit.push({ datum: isoVan(t), status: b.platform, gast: b.gast || null, gasten: b.gasten || null,
               code: b.code || null, url: b.url || null, aankomst: isoVan(t) === b.aankomst, vertrek: false });
  }
  return uit;
}

// Wissels: dagen waarop de ene gast vertrekt en de volgende aankomt (tussen 12:00 en 16:00).
// `dagen` = rijen uit loft_dagen (gesorteerd of niet). Geeft [{datum, weg, komt}].
export function wissels(dagen) {
  const per = new Map(dagen.map(r => [r.datum, r]));
  const uit = [];
  for (const r of dagen) {
    if (!r.aankomst) continue;
    const gisteren = isoVan(new Date(dag(r.datum).getTime() - 864e5));
    const g = per.get(gisteren);
    if (g && (g.status === "airbnb" || g.status === "booking") && g.code !== r.code) {
      uit.push({ datum: r.datum, weg: { platform: g.status, gast: g.gast }, komt: { platform: r.status, gast: r.gast } });
    }
  }
  return uit;
}

// Weekend = vrijdag- en zaterdagnacht.
export function isWeekendNacht(iso) { const w = dag(iso).getDay(); return w === 5 || w === 6; }

// Gastprijs voor een vrije dag volgens de instellingen, begrensd door minimum en maximum.
export function gastprijsVoor(iso, inst) {
  const basis = isWeekendNacht(iso) ? inst.weekend : inst.weekdag;
  if (!(basis > 0)) throw new Error("geen prijs ingesteld voor " + iso);
  let p = basis;
  if (inst.minimum > 0) p = Math.max(p, inst.minimum);
  if (inst.maximum > 0) p = Math.min(p, inst.maximum);
  return p;
}

// 12:00 lokaal (Europe/Amsterdam) op een datum, als iCal-tijdstip in UTC. Zomertijd: laatste zo maart t/m laatste zo oktober.
export function middagUtc(iso) {
  const d = dag(iso);
  const laatsteZondag = m => { const x = new Date(d.getFullYear(), m + 1, 0); x.setDate(x.getDate() - x.getDay()); return x; };
  const zomer = d >= laatsteZondag(2) && d < laatsteZondag(9);
  return iso.replace(/-/g, "") + "T" + (zomer ? "10" : "11") + "0000Z";
}

// iCal-feed (één kalender per platform) uit loft_dagen-rijen: één hele-dag-event per boeking (code),
// van aankomstdag t/m laatste nacht (zodat vertrek- en aankomstdag niet overlappen in de maandweergave),
// met de reserveringslink en een herinnering om 12:00 op de aankomstdag: 4 uur voor de gast er is.
export function icsVanDagen(dagen, platform, naam) {
  const rijen = dagen.filter(r => r.status === platform).sort((a, b) => a.datum.localeCompare(b.datum));
  const boekingen = new Map();
  for (const r of rijen) {
    const sleutel = r.code || (r.gast || "gast") + "@" + r.datum;
    const b = boekingen.get(sleutel) || { eerste: r.datum, laatste: r.datum, gast: r.gast, gasten: r.gasten, url: r.url, code: r.code };
    // Zonder code: alleen aaneengesloten dagen bij elkaar houden
    if (!r.code && boekingen.has(sleutel) === false) {
      const vorige = [...boekingen.values()].find(x => !x.code && x.gast === r.gast && isoVan(new Date(dag(x.laatste).getTime() + 864e5)) === r.datum);
      if (vorige) { vorige.laatste = r.datum; continue; }
    }
    if (r.datum < b.eerste) b.eerste = r.datum;
    if (r.datum > b.laatste) b.laatste = r.datum;
    boekingen.set(sleutel, b);
  }
  const label = platform === "airbnb" ? "Airbnb" : "Booking";
  const stamp = s => s.replace(/-/g, "");
  const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const regels = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Begeister//Loft//NL", "X-WR-CALNAME:" + esc(naam), "X-WR-TIMEZONE:Europe/Amsterdam"];
  for (const [sleutel, b] of boekingen) {
    const vertrek = isoVan(new Date(dag(b.laatste).getTime() + 864e5));
    const titel = label + " · " + (b.gast || "gast") + (b.gasten ? " (" + b.gasten + ")" : "");
    regels.push("BEGIN:VEVENT",
      "UID:loft-" + platform + "-" + sleutel.replace(/[^A-Za-z0-9@-]/g, "") + "@begeister.nl",
      "DTSTART;VALUE=DATE:" + stamp(b.eerste),
      "DTEND;VALUE=DATE:" + stamp(vertrek),
      "SUMMARY:" + esc(titel),
      "DESCRIPTION:" + esc((b.code ? "Code " + b.code + "\n" : "") + "Aankomst 16:00, vertrek 12:00"),
      ...(b.url ? ["URL:" + b.url] : []),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(titel + " komt om 16:00"), "TRIGGER;VALUE=DATE-TIME:" + middagUtc(b.eerste), "END:VALARM",
      "END:VEVENT");
  }
  regels.push("END:VCALENDAR");
  return regels.join("\r\n") + "\r\n";
}

// Schoonmaakmomenten: elke vertrekdag (de dag na de laatste nacht van een boeking) vanaf 12:00.
// Komt dezelfde dag een nieuwe gast, dan is het een wissel en moet het voor 16:00 af zijn.
// Anders tot 14:00, met de datum van de eerstvolgende aankomst erbij. Geeft [{datum, tot, wissel, weg, volgende}].
export function schoonmaak(dagen) {
  const per = new Map(dagen.map(r => [r.datum, r]));
  const gesorteerd = [...dagen].filter(r => r.status === "airbnb" || r.status === "booking").sort((a, b) => a.datum.localeCompare(b.datum));
  const uit = [];
  for (const r of gesorteerd) {
    const morgen = isoVan(new Date(dag(r.datum).getTime() + 864e5));
    const m = per.get(morgen);
    const zelfdeBoeking = m && (m.status === "airbnb" || m.status === "booking") && m.code === r.code && !m.aankomst;
    if (zelfdeBoeking) continue;                       // gast blijft nog een nacht
    const wissel = !!(m && m.aankomst && (m.status === "airbnb" || m.status === "booking"));
    const volgende = wissel ? m : gesorteerd.find(x => x.datum > r.datum && x.aankomst) || null;
    uit.push({ datum: morgen, tot: wissel ? "16:00" : "14:00", wissel, weg: { platform: r.status, gast: r.gast },
               volgende: volgende ? { datum: volgende.datum, platform: volgende.status, gast: volgende.gast } : null });
  }
  return uit;
}
