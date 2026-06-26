// Gedeelde helpers: service-role Supabase-client + verbruik loggen in `usage`.
import { createClient } from "@supabase/supabase-js";

// Prijzen (USD per 1.000.000 tokens) en per web-search.
export const PRICE_IN = 3;      // input tokens
export const PRICE_OUT = 15;    // output tokens
export const WEB_SEARCH = 0.01; // per web_search request
export const EUR_RATE = 0.92;   // USD -> EUR (benadering, vaste constante)

// Service-role client; geeft null terug als env ontbreekt (faalt dan stil).
export function svc() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Tel web-searches uit een Anthropic-respons (usage-veld of result-blokken).
export function countWebSearches(resp) {
  try {
    const n = resp?.usage?.server_tool_use?.web_search_requests;
    if (typeof n === "number") return n;
  } catch (_) { /* ignore */ }
  let c = 0;
  try {
    for (const b of resp?.content || []) {
      if (b && b.type === "web_search_tool_result") c++;
    }
  } catch (_) { /* ignore */ }
  return c;
}

// Bereken kosten in USD.
export function costUsd(inTok, outTok, webSearches) {
  return (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT + webSearches * WEB_SEARCH;
}

// Log één verbruiksregel. Faalt ALTIJD stil; breekt nooit de hoofdfunctie.
export async function logUsage(db, { source, model, inputTokens = 0, outputTokens = 0, webSearches = 0 }) {
  try {
    const client = db || svc();
    if (!client) return;
    await client.from("usage").insert({
      source,
      model: model || null,
      input_tokens: Math.round(inputTokens) || 0,
      output_tokens: Math.round(outputTokens) || 0,
      web_searches: Math.round(webSearches) || 0,
      cost_usd: costUsd(inputTokens, outputTokens, webSearches),
    });
  } catch (e) {
    try { console.error("usage-log-fout:", e.message); } catch (_) { /* ignore */ }
  }
}
