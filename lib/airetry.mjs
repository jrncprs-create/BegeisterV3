// Kleine retry-wrapper om Anthropic-calls robuust te maken tegen tijdelijke
// netwerkfouten (bv. "Premature close", "fetch failed", ECONNRESET) die tijdens
// een API-storing of flaky verbinding optreden. Retryt alleen verbindingsfouten,
// niet echte API-fouten (400/401/429 laten we meteen doorgooien).
const TRANSIENT = /premature close|fetch failed|econnreset|und_err|socket hang up|network|terminated|timeout|etimedout|enotfound|eai_again/i;

function isTransient(err) {
  const msg = String((err && (err.message || err.cause?.message)) || err || "");
  const status = err && (err.status || err.statusCode);
  if (status && status < 500 && status !== 429) return false; // echte client-fout: niet retryen
  return TRANSIENT.test(msg) || status === 429 || (status && status >= 500);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Roept anthropic.messages.create aan met automatische herhaalpogingen bij
 * tijdelijke verbindingsfouten. Gooit de laatste fout door als alles faalt.
 * @param {import('@anthropic-ai/sdk').default} anthropic
 * @param {object} params - messages.create params
 * @param {number} tries - totaal aantal pogingen (default 3)
 */
export async function createMessage(anthropic, params, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await anthropic.messages.create(params);
    } catch (e) {
      lastErr = e;
      if (i === tries - 1 || !isTransient(e)) throw e;
      const wait = 600 * (i + 1) + Math.floor(Math.random() * 400);
      try { console.error(`AI-call faalde (poging ${i + 1}/${tries}): ${String(e.message || e)} — opnieuw over ${wait}ms`); } catch (_) {}
      await sleep(wait);
    }
  }
  throw lastErr;
}
