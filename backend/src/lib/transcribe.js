import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSTTProvider, resolveLocalWhisper } from './providers.js';

function extensionFor(mimeType) {
  const type = mimeType || '';
  if (type.includes('wav')) return 'wav';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('mp4') || type.includes('m4a')) return 'mp4';
  return 'webm';
}

function whisperLanguage(lang) {
  if (!lang) return '';
  const code = String(lang).toLowerCase();
  if (code.startsWith('ta')) return 'ta';
  if (code.startsWith('en')) return 'en';
  return code.split('-')[0];
}

async function transcribeWithOpenAICompatible(buffer, mimeType, provider, lang) {
  const form = new FormData();
  const extension = extensionFor(mimeType);
  const type = mimeType || 'audio/webm';
  const bytes = new Uint8Array(buffer);
  const file = typeof File !== 'undefined' ? new File([bytes], `audio.${extension}`, { type }) : new Blob([bytes], { type });
  form.append('file', file, `audio.${extension}`);
  form.append('model', provider.model);
  const whisperLang = whisperLanguage(lang);
  if (whisperLang) form.append('language', whisperLang);

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

async function transcribeWithGoogle(buffer, mimeType, provider, lang) {
  const isWav = mimeType?.includes('wav');
  const languageCode = lang || 'en-IN';
  const config = {
    encoding: isWav ? 'LINEAR16' : 'WEBM_OPUS',
    languageCode,
    alternativeLanguageCodes: languageCode.startsWith('ta') ? ['en-IN'] : ['ta-IN'],
  };
  if (isWav) config.sampleRateHertz = 16000;
  const body = { config, audio: { content: Buffer.from(buffer).toString('base64') } };
  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${provider.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Speech-to-text request failed (google): ${response.status} ${detail}`.trim());
  }
  const data = await response.json();
  return (data.results || []).map((r) => r.alternatives?.[0]?.transcript || '').join(' ').trim();
}

function runWhisperCli({ executable, model, audioFile, language, threads, extraArgs = [] }) {
  return new Promise((resolve, reject) => {
    const args = ['-m', model, '-f', audioFile, '-nt', '-otxt', '-of', audioFile.replace(/\.[^.]+$/, '')];
    if (language) args.push('-l', language);
    if (threads) args.push('-t', String(threads));
    args.push(...extraArgs);
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`whisper.cpp exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
      resolve({ stdout, stderr });
    });
  });
}

export async function transcribeWithLocalWhisper(buffer, mimeType, lang) {
  const local = resolveLocalWhisper();
  if (!local) {
    throw new Error('Local whisper.cpp fallback is not configured. Set WHISPER_CPP_PATH and WHISPER_MODEL_PATH in backend/.env.');
  }
  if (!(mimeType || '').includes('wav')) {
    throw new Error('Local whisper.cpp expects 16-bit PCM WAV audio. The browser fallback sends WAV audio.');
  }
  const temp = await mkdtemp(join(tmpdir(), 'consult-scribe-whisper-'));
  const audioFile = join(temp, 'audio.wav');
  try {
    await writeFile(audioFile, Buffer.from(buffer));
    const outputBase = audioFile.replace(/\.wav$/i, '');
    await runWhisperCli({
      executable: local.executable,
      model: local.model,
      audioFile,
      language: whisperLanguage(lang),
      threads: local.threads,
      extraArgs: local.extraArgs,
    });
    const { readFile } = await import('node:fs/promises');
    const textFile = `${outputBase}.txt`;
    const text = (await readFile(textFile, 'utf8')).trim();
    return text;
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function transcribeAudio(buffer, mimeType, lang, options = {}) {
  if (options.localOnly) return transcribeWithLocalWhisper(buffer, mimeType, lang);

  const provider = resolveSTTProvider();
  if (!provider) {
    throw new Error('No speech-to-text provider configured. Start a consultation and, if internet speech recognition is unavailable, configure the local whisper.cpp fallback in backend/.env.');
  }
  if (provider.name === 'google') return transcribeWithGoogle(buffer, mimeType, provider, lang);
  return transcribeWithOpenAICompatible(buffer, mimeType, provider, lang);
}
