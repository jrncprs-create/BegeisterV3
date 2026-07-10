// Het weer voor de ochtendkaart. Open-Meteo, geen sleutel, geen account.
//
// Waarom via de server en niet rechtstreeks: zo staat er geen extern adres in de app,
// zit het antwoord in ons eigen antwoordformaat, en kunnen we het cachen. Een kwartier
// is genoeg — het weer verandert niet sneller dan de pagina wordt ververst.
//
// GET/POST /api/weer?lat=51.92&lon=4.48
const CACHE = new Map();
const CACHE_MS = 15 * 60 * 1000;

// Open-Meteo's WMO-codes, teruggebracht tot wat je 's ochtends wilt weten.
const CODES = {
  0: ["Helder", "zon"], 1: ["Overwegend helder", "zon"], 2: ["Half bewolkt", "wolk"], 3: ["Bewolkt", "wolk"],
  45: ["Mist", "mist"], 48: ["IJzelmist", "mist"],
  51: ["Motregen", "regen"], 53: ["Motregen", "regen"], 55: ["Motregen", "regen"],
  61: ["Regen", "regen"], 63: ["Regen", "regen"], 65: ["Zware regen", "regen"],
  66: ["IJzel", "regen"], 67: ["IJzel", "regen"],
  71: ["Sneeuw", "sneeuw"], 73: ["Sneeuw", "sneeuw"], 75: ["Zware sneeuw", "sneeuw"], 77: ["Sneeuwkorrels", "sneeuw"],
  80: ["Buien", "regen"], 81: ["Buien", "regen"], 82: ["Zware buien", "regen"],
  85: ["Sneeuwbuien", "sneeuw"], 86: ["Sneeuwbuien", "sneeuw"],
  95: ["Onweer", "onweer"], 96: ["Onweer met hagel", "onweer"], 99: ["Onweer met hagel", "onweer"],
};

export default async function handler(req, res) {
  const q = req.query || {};
  const b = req.body || {};
  const lat = Number(q.lat ?? b.lat);
  const lon = Number(q.lon ?? b.lon);
  if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: "lat en lon zijn verplicht" });

  const sleutel = lat.toFixed(2) + "," + lon.toFixed(2);
  const nu = Date.now();
  const bewaard = CACHE.get(sleutel);
  if (bewaard && nu - bewaard.tijd < CACHE_MS) return res.status(200).json(bewaard.data);

  try {
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.searchParams.set("latitude", String(lat));
    u.searchParams.set("longitude", String(lon));
    u.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
    u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code");
    u.searchParams.set("timezone", "auto");
    u.searchParams.set("forecast_days", "2");

    const r = await fetch(u.toString());
    if (!r.ok) return res.status(200).json({ error: "weer niet beschikbaar" });
    const d = await r.json();

    const code = d?.current?.weather_code ?? 0;
    const [tekst, icoon] = CODES[code] || ["Onbekend", "wolk"];

    const data = {
      nu: {
        temp: Math.round(d?.current?.temperature_2m ?? 0),
        gevoel: Math.round(d?.current?.apparent_temperature ?? 0),
        wind: Math.round(d?.current?.wind_speed_10m ?? 0),
        tekst, icoon,
      },
      vandaag: {
        max: Math.round(d?.daily?.temperature_2m_max?.[0] ?? 0),
        min: Math.round(d?.daily?.temperature_2m_min?.[0] ?? 0),
        regenkans: Math.round(d?.daily?.precipitation_probability_max?.[0] ?? 0),
      },
      morgen: {
        max: Math.round(d?.daily?.temperature_2m_max?.[1] ?? 0),
        min: Math.round(d?.daily?.temperature_2m_min?.[1] ?? 0),
        regenkans: Math.round(d?.daily?.precipitation_probability_max?.[1] ?? 0),
        tekst: (CODES[d?.daily?.weather_code?.[1] ?? 0] || ["Onbekend"])[0],
      },
    };

    CACHE.set(sleutel, { tijd: nu, data });
    return res.status(200).json(data);
  } catch (e) {
    console.error("weer", e && e.message);
    return res.status(200).json({ error: "weer niet beschikbaar" });
  }
}
