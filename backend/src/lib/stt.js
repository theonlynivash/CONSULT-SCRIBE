import FormData from 'form-data';

const XAI_STT_URL = 'https://api.x.ai/v1/stt';







const DEFAULT_MODEL =
  process.env.XAI_STT_MODEL || 'grok-2-audio';




export function sttConfigured() {
  return Boolean(
    process.env.XAI_API_KEY
  );
}





function extensionForMimeType(
  mimeType = ''
) {
  const type =
    mimeType
      .split(';')[0]
      .trim()
      .toLowerCase();

  if (type === 'audio/webm') {
    return 'webm';
  }

  if (type === 'audio/ogg') {
    return 'ogg';
  }

  if (type === 'audio/wav' ||
      type === 'audio/x-wav') {
    return 'wav';
  }

  if (type === 'audio/mpeg' ||
      type === 'audio/mp3') {
    return 'mp3';
  }

  if (type === 'audio/mp4' ||
      type === 'audio/m4a' ||
      type === 'audio/x-m4a') {
    return 'm4a';
  }

  return 'webm';
}









export async function transcribeAudio({
  buffer,
  mimeType = 'audio/webm',
  language,
}) {
  if (!sttConfigured()) {
    const error = new Error(
      'XAI_API_KEY is not configured.'
    );

    error.code =
      'STT_NOT_CONFIGURED';

    throw error;
  }

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    const error = new Error(
      'No audio data was supplied.'
    );

    error.code =
      'INVALID_AUDIO';

    throw error;
  }

  const extension =
    extensionForMimeType(
      mimeType
    );

  


  const form =
    new FormData();

  form.append(
    'file',
    buffer,
    {
      filename:
        `consultation.${extension}`,
      contentType:
        mimeType,
    }
  );

  form.append(
    'model',
    DEFAULT_MODEL
  );

  



  if (language) {
    form.append(
      'language',
      language
    );
  }

  const response =
    await fetch(
      XAI_STT_URL,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${process.env.XAI_API_KEY}`,

          ...form.getHeaders(),
        },

        body: form,
      }
    );

  const rawText =
    await response.text();

  let data = null;

  try {
    data =
      rawText
        ? JSON.parse(rawText)
        : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const providerMessage =
      data?.error?.message ||
      data?.error ||
      rawText ||
      `xAI STT request failed with status ${response.status}`;

    const error = new Error(
      String(providerMessage)
    );

    error.status =
      response.status;

    error.code =
      'STT_PROVIDER_ERROR';

    throw error;
  }

  



  const text =
    typeof data?.text === 'string'
      ? data.text.trim()
      : '';

  if (!text) {
    const error = new Error(
      'xAI STT returned an empty transcript.'
    );

    error.code =
      'EMPTY_TRANSCRIPT';

    throw error;
  }

  return {
    text,

    




    language:
      data?.language || null,

    duration:
      data?.duration ?? null,
  };
}