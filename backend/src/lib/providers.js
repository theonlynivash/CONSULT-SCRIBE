export function grokConfigured() {
  return Boolean(String(process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim());
}
