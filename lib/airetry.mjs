// Kleine retry-wrapper om Anthropic-calls robuust te maken tegen tijdelijke
// netwerkfouten (bv. "Premature close", "fetch failed", ECONNRESET) die tijdens
// een API-storing of flaky verbinding optreden. Retryt alleen verbindingsfouten,
// niet echte API-fouten (400/401/429 laten we meteen doorgooien).
// Forceer verse verbindingen naar externe API's. Hergebruikte keep-alive-verbindingen die
// Anthropic (of een tussenliggende proxy) al had gesloten, veroorzaakten 'Premature close'
// bij álle AI-calls. Korte keep-alive = elke call een frisse verbinding; body/headers-timeout
// uit zodat een wat traag AI-antwoord niet voortijdig wordt afgekapt.
try {
  const { setGlobalDispatcher, Agent } = await import("undici");
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 1, keepAliveMaxTimeout: 1, bodyTimeout: 0, headersTimeout: 0, connect: { timeout: 60000 } }));
} catch (e) {
  try { console.error("undici-dispatcher niet gezet:", e && e.message); } catch (_) {}
}

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

/**
 * Zelfde als createMessage, maar via STREAMING (anthropic.messages.stream).
 * Streaming houdt de verbinding levend met tussentijdse events, waardoor trage of
 * grote requests (bv. een PDF laten samenvatten) niet meer sneuvelen op
 * "Premature close"/socket-timeouts. Geeft hetzelfde eind-Message terug als create().
 */
export async function createMessageStream(anthropic, params, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const stream = anthropic.messages.stream(params);
      return await stream.finalMessage();
    } catch (e) {
      lastErr = e;
      if (i === tries - 1 || !isTransient(e)) throw e;
      const wait = 600 * (i + 1) + Math.floor(Math.random() * 400);
      try { console.error(`AI-stream faalde (poging ${i + 1}/${tries}): ${String(e.message || e)} — opnieuw over ${wait}ms`); } catch (_) {}
      await sleep(wait);
    }
  }
  throw lastErr;
}
