// Gedeelde spraak-naar-tekst helper (Groq Whisper, whisper-large-v3-turbo).
// Gebruikt door de in-app dictafoon (api/transcribe.mjs) én WhatsApp-voicenotes (intake/whatsapp.mjs).
// Claude/Anthropic kan geen audio transcriberen; daarom een aparte STT-dienst via een OpenAI-compatibele endpoint.
const GROQ_KEY = (process.env.GROQ_API_KEY || "").trim();
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

export function hasTranscription() { return !!GROQ_KEY; }

// buf = Buffer met de audiobytes. Geeft de platte transcriptietekst terug; gooit bij ontbrekende key of API-fout.
export async function transcribeAudio(buf, mime, filename) {
  if (!GROQ_KEY) throw new Error("no-transcription-key");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime || "audio/ogg" }), filename || "spraak.ogg");
  form.append("model", GROQ_MODEL);
  form.append("language", "nl");
  form.append("response_format", "json");
  form.append("temperature", "0");
  const r = await fetch(GROQ_URL, { method: "POST", headers: { Authorization: "Bearer " + GROQ_KEY }, body: form });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("Groq " + r.status + ": " + t.slice(0, 300));
  }
  const j = await r.json();
  return (j && typeof j.text === "string") ? j.text.trim() : "";
}
