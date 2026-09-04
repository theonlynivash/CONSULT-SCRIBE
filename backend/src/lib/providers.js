function trim(value) {
  return (value || '').trim();
}

export function resolveSTTProvider() {
  const googleKey = trim(process.env.GOOGLE_CLOUD_STT_KEY);
  if (googleKey) return { name: 'google', apiKey: googleKey };

  const openaiKey = trim(process.env.OPENAI_API_KEY);
  if (openaiKey) {
    return {
      name: 'openai',
      apiKey: openaiKey,
      baseUrl: trim(process.env.OPENAI_BASE_URL) || 'https://api.openai.com/v1',
      model: 'whisper-1',
    };
  }

  const groqKey = trim(process.env.GROQ_API_KEY);
  if (groqKey) {
    return {
      name: 'groq',
      apiKey: groqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'whisper-large-v3',
    };
  }

  return null;
}

export function sttConfigured() {
  return Boolean(resolveSTTProvider());
}

export function resolveLocalWhisper() {
  const executable = trim(process.env.WHISPER_CPP_PATH);
  const model = trim(process.env.WHISPER_MODEL_PATH);
  if (!executable || !model) return null;
  return {
    executable,
    model,
    threads: Number(process.env.WHISPER_THREADS || 0) || undefined,
    extraArgs: trim(process.env.WHISPER_CPP_ARGS) ? trim(process.env.WHISPER_CPP_ARGS).split(/\s+/) : [],
  };
}

export function localWhisperConfigured() {
  return Boolean(resolveLocalWhisper());
}
