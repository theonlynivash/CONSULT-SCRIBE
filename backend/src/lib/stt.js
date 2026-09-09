const XAI_STT_URL = 'https://api.x.ai/v1/stt';

const MEDICAL_KEYTERMS = [
  'SpO2',
  'HbA1c',
  'ECG',
  'BP',
  'blood pressure',
  'heart rate',
  'pulse oximeter',
  'CBC',
  'creatinine',
  'hemoglobin',
  'diabetes',
  'hypertension',
  'hypotension',
  'paracetamol',
  'amoxicillin',
];

export function sttConfigured() {
  return Boolean(process.env.XAI_API_KEY);
}

export async function transcribeAudio({ buffer, mimeType, language }) {
  if (!sttConfigured()) {
    const error = new Error(
      'Grok Speech-to-Text is not configured. Add XAI_API_KEY to backend/.env.'
    );
    error.code = 'STT_NOT_CONFIGURED';
    throw error;
  }

  if (!buffer || !buffer.length) {
    const error = new Error('The uploaded audio segment is empty.');
    error.code = 'EMPTY_AUDIO';
    throw error;
  }

  const form = new FormData();

  if (language) {
    form.append('format', 'true');
    form.append('language', language);
  }

  for (const keyterm of MEDICAL_KEYTERMS) {
    form.append('keyterm', keyterm);
  }

  const extension = extensionForMime(mimeType);
  const blob = new Blob([buffer], {
    type: mimeType || 'audio/webm',
  });

  form.append(
    'file',
    blob,
    `consultation.${extension}`
  );

  let response;

  try {
    response = await fetch(XAI_STT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: form,
    });
  } catch (err) {
    const error = new Error(
      `Could not reach Grok Speech-to-Text: ${
        err?.message || 'network error'
      }`
    );
    error.code = 'STT_NETWORK_ERROR';
    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const providerMessage =
      payload?.error?.message ||
      payload?.error ||
      `xAI Speech-to-Text returned HTTP ${response.status}`;

    const error = new Error(String(providerMessage));
    error.code = 'STT_PROVIDER_ERROR';
    error.status = response.status;

    throw error;
  }

  return {
    text: String(payload.text || '').trim(),
    language: payload.language || undefined,
    duration:
      typeof payload.duration === 'number'
        ? payload.duration
        : undefined,
  };
}

function extensionForMime(mimeType = '') {
  const type = mimeType.toLowerCase().split(';')[0];

  if (type === 'audio/mp4' || type === 'audio/m4a') {
    return 'm4a';
  }

  if (type === 'audio/ogg') {
    return 'ogg';
  }

  if (type === 'audio/mpeg' || type === 'audio/mp3') {
    return 'mp3';
  }

  if (type === 'audio/wav' || type === 'audio/x-wav') {
    return 'wav';
  }

  if (type === 'audio/aac') {
    return 'aac';
  }

  if (type === 'audio/webm') {
    return 'webm';
  }

  return 'webm';
}