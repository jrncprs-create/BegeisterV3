// Verbruik-endpoint (GET): telt het verbruik van de HUIDIGE kalendermaand op
// en geeft bedragen in euro terug (EUR_RATE is een benadering, vaste constante).
import { svc, EUR_RATE } from "../lib/usage.mjs";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  try {
    const db = svc();
    const now = new Date();
    const monthName = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const empty = {
      month: monthName, usd: 0, eur: 0,
      breakdown: { chat: 0, intake: 0, vision: 0 },
      tokens: { input: 0, output: 0, web_searches: 0 },
    };
    if (!db) return res.status(200).json(empty);

    // Begin van de huidige kalendermaand (UTC) als ondergrens.
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data, error } = await db
      .from("usage")
      .select("source, cost_usd, input_tokens, output_tokens, web_searches, at")
      .gte("at", start);
    if (error) return res.status(200).json(empty);

    let usd = 0, input = 0, output = 0, web = 0;
    const bd = { chat: 0, intake: 0, vision: 0 };
    for (const r of data || []) {
      const c = Number(r.cost_usd) || 0;
      usd += c;
      input += Number(r.input_tokens) || 0;
      output += Number(r.output_tokens) || 0;
      web += Number(r.web_searches) || 0;
      if (r.source in bd) bd[r.source] += c;
    }
    const eur = usd * EUR_RATE;
    return res.status(200).json({
      month: monthName,
      usd,
      eur,
      breakdown: {
        chat: bd.chat * EUR_RATE,
        intake: bd.intake * EUR_RATE,
        vision: bd.vision * EUR_RATE,
      },
      tokens: { input, output, web_searches: web },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
