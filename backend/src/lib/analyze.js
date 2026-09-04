const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

const REPORT_SCHEMA = `Return only this JSON shape:
{
  "chiefComplaint": "2-6 word main complaint",
  "querySummary": "1-3 sentence summary",
  "patientProblems": [{"problem":"","duration":"Not mentioned","severity":"Not mentioned","quote":""}],
  "predictedProblems": [{"label":"","severity":"mild|moderate|severe|not_specified","confidence":"low|medium|high","rationale":"","evidenceQuote":""}],
  "suggestedActionItems": [{"item":"","source":"doctor_mentioned|ai_suggested"}],
  "nextCheckup": {"date":"","instruction":"Not specified"}
}`;

const SYSTEM_PROMPT = `You are a careful clinical documentation assistant supporting a licensed doctor.
Analyze the complete doctor-patient conversation and return valid JSON only.
Use only facts present in the conversation and supplied vitals. Never invent symptoms, diagnoses,
medications, tests, dates, or doctor instructions. Possible conditions are not confirmed diagnoses.
Understand English, Tamil, and Tamil-English mixed speech. Write the report in English, but copy
quote and evidenceQuote exactly from the original conversation. Every patient problem and possible
condition must include a short verbatim quote from the conversation; omit unsupported conditions.
Include relevant action items only when supported, and preserve doctor-mentioned instructions.
${REPORT_SCHEMA}`;

const REFINE_SYSTEM_PROMPT = `You revise a clinical report draft for a licensed doctor. Return JSON only.
Keep the exact report shape and only make the requested change. Never invent clinical findings.
Possible conditions must remain clearly labeled as possibilities.`;

const INSTRUCTION_TEXT = {
  'more-detailed': 'Make the query summary more detailed without adding facts.',
  'less-detailed': 'Make the query summary more concise without removing important facts.',
  'add-billing-codes': 'Suggest relevant ICD-10 billing codes as additional action items, without confirming a diagnosis.',
  'update-pronouns': 'Use neutral pronouns for the patient.',
};

function requireApiKey() {
  const apiKey = String(process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '').trim();
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured. Add it to backend/.env.');
  return apiKey;
}

function transcriptText(consultation) {
  return (consultation.transcript || [])
    .map((entry) => `${String(entry.speaker || 'conversation').toUpperCase()}: ${entry.text}`)
    .join('\n');
}

function vitalsSummary(consultation) {
  const vitals = consultation.vitals || [];
  return vitals.length
    ? vitals.map((vital) => `${vital.type}: ${vital.value}${vital.unit || ''} (${vital.source || 'unknown'})`).join(', ')
    : 'No vitals recorded.';
}

function parseJson(content) {
  const cleaned = String(content || '').replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  if (!cleaned) throw new Error('Groq returned an empty response.');
  return JSON.parse(cleaned);
}

function normalizeReport(report, consultation, generatedBy) {
  const predictedProblems = Array.isArray(report.predictedProblems) ? report.predictedProblems : [];
  const suggestedActionItems = Array.isArray(report.suggestedActionItems) ? report.suggestedActionItems : [];
  return {
    chiefComplaint: report.chiefComplaint || 'General consultation',
    querySummary: report.querySummary || 'No summary was generated.',
    patientProblems: Array.isArray(report.patientProblems) ? report.patientProblems : [],
    predictedProblems,
    suggestedActionItems,
    nextCheckup: report.nextCheckup || { date: '', instruction: 'Not specified' },
    subjective: report.querySummary || '',
    objective: vitalsSummary(consultation),
    assessment: predictedProblems.map((problem) => `${problem.label || 'Possible condition'} (${problem.confidence || 'low'}) - ${problem.rationale || ''}`).join('\n') || 'No possible condition identified.',
    differential: predictedProblems,
    plan: suggestedActionItems.map((item) => `${typeof item === 'string' ? item : item.item} [${typeof item === 'string' || item.source === 'ai_suggested' ? 'AI suggested' : 'Doctor mentioned'}]`),
    suggestedQuestions: [],
    generatedBy,
    generatedAt: new Date().toISOString(),
  };
}

async function callGroq(messages, options = {}) {
  const response = await fetch(process.env.GROQ_BASE_URL || GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${requireApiKey()}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || process.env.GROK_MODEL || DEFAULT_MODEL,
      temperature: options.temperature ?? 0.1,
      response_format: { type: 'json_object' },
      messages,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Groq request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  const data = await response.json();
  return parseJson(data.choices?.[0]?.message?.content);
}

async function analyzeWithGroq(consultation, patient) {
  const userPrompt = `Patient age: ${patient?.age ?? 'unknown'}.
Patient history on file: ${patient?.historyNotes || 'none'}.
Vitals: ${vitalsSummary(consultation)}
Conversation:
${transcriptText(consultation) || '(no conversation captured)'}`;
  const report = await callGroq([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);
  return normalizeReport(report, consultation, 'groq');
}

export async function analyzeConsultation(consultation, patient) {
  return analyzeWithGroq(consultation, patient);
}

export async function refineDraft(draft, instructionKey) {
  const instruction = INSTRUCTION_TEXT[instructionKey] || instructionKey;
  const revised = await callGroq([
    { role: 'system', content: REFINE_SYSTEM_PROMPT },
    { role: 'user', content: `Instruction: ${instruction}\n\nCurrent report JSON:\n${JSON.stringify(draft)}` },
  ], { temperature: 0.2 });
  return { ...draft, ...revised, generatedBy: 'groq', generatedAt: new Date().toISOString() };
}