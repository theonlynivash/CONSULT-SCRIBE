// Speech-to-text for audio uploaded by the patient-side hardware mic
// (ESP32 + I2S mic). Two genuinely different providers are supported:
//
// - OpenAI/Groq: an OpenAI-compatible /audio/transcriptions multipart
//   endpoint — same shape for both, just a different base URL + key.
// - Google Cloud Speech-to-Text: NOT OpenAI-compatible. Separate REST API
//   (JSON body, base64 audio, its own response shape) — a real distinct
//   code path, not a drop-in swap like the LLM side gets with Gemini.
//
// There is no offline fallback for speech-to-text — if no provider
// resolves, this throws a clear error rather than silently doing nothing.

import { resolveSTTProvider } from './providers.js';

async function transcribeWithOpenAICompatible(buffer, mimeType, provider) {
  const form = new FormData();
  const extension = mimeType?.includes('wav') ? 'wav' : 'webm';
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/wav' }), `audio.${extension}`);
  form.append('model', provider.model);

  const response = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Speech-to-text request failed (${provider.name}): ${response.status} ${detail}`.trim());
  }

  const data = await response.json();
  return (data.text || '').trim();
}

// The ESP32 firmware sends 16kHz mono 16-bit WAV (see firmware/patient_mic).
// Untested against a real Google Cloud key in this session — verify the
// encoding/sampleRate match what your device actually sends.
async function transcribeWithGoogle(buffer, mimeType, provider) {
  const encoding = mimeType?.includes('wav') ? 'LINEAR16' : 'WEBM_OPUS';
  const body = {
    config: {
      encoding,
      sampleRateHertz: 16000,
      languageCode: 'en-IN',
      alternativeLanguageCodes: ['ta-IN'],
    },
    audio: { content: buffer.toString('base64') },
  };

  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${provider.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Speech-to-text request failed (google): ${response.status} ${detail}`.trim());
  }

  const data = await response.json();
  return (data.results || []).map((r) => r.alternatives?.[0]?.transcript || '').join(' ').trim();
}

export async function transcribeAudio(buffer, mimeType) {
  const provider = resolveSTTProvider();
  if (!provider) {
    throw new Error(
      'No speech-to-text provider configured. Set GOOGLE_CLOUD_STT_KEY, OPENAI_API_KEY, or GROQ_API_KEY in backend/.env to enable hardware mic transcription.'
    );
  }

  if (provider.name === 'google') return transcribeWithGoogle(buffer, mimeType, provider);
  return transcribeWithOpenAICompatible(buffer, mimeType, provider);
}
