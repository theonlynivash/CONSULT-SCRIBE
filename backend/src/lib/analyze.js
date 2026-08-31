const SYSTEM_PROMPT = `You are a clinical documentation assistant supporting a licensed doctor during a live consultation.
You never diagnose or prescribe. You write a standard SOAP-format note as decision support only, plus a
ranked differential of possible conditions the doctor should consider investigating further, each with a
rough confidence (low/medium/high) and a one-line rationale grounded in what was actually said or measured.
If evidence is thin, say so plainly instead of guessing.

The transcript may be in Tamil, English, or a mix of both (code-switching between Tamil and English is normal
in Indian clinical settings). Regardless of the input language, write every field of your response in English.

Respond ONLY with JSON in this exact shape:
{
  "chiefComplaint": string,
  "subjective": string,
  "objective": string,
  "assessment": string,
  "differential": [{ "condition": string, "confidence": "low"|"medium"|"high", "rationale": string }],
  "plan": string[],
  "suggestedQuestions": string[]
}
"chiefComplaint" is a short 2-6 word phrase (e.g. "lower back pain") used as the note's title.`;

const REFINE_SYSTEM_PROMPT = `You revise an existing clinical note draft based on a doctor's instruction.
Keep the exact same JSON shape you're given. Only change what the instruction asks for — never invent new
clinical findings that weren't already in the note.`;

const INSTRUCTION_TEXT = {
  'more-detailed': 'Make this note more detailed.',
  'less-detailed': 'Make this note less detailed and more concise.',
  'add-billing-codes': 'Suggest relevant ICD-10 billing codes and add them to the plan.',
  'update-pronouns': 'Update the pronouns used to refer to the patient.',
};

function transcriptText(consultation) {
  return consultation.transcript.map((t) => `${t.speaker}: ${t.text}`).join('\n');
}

// Heuristic symptom detection only scans what the patient said, not the
// doctor's questions — otherwise "any chest pain?" gets misread as the
// patient reporting chest pain.
function patientText(consultation) {
  return consultation.transcript
    .filter((t) => t.speaker === 'patient')
    .map((t) => t.text)
    .join(' ');
}

function vitalsSummary(consultation) {
  if (!consultation.vitals.length) return 'No vitals recorded.';
  return consultation.vitals.map((v) => `${v.type}: ${v.value}${v.unit} (${v.source})`).join(', ');
}

// Keys stay English regardless of which language matched, since the keys
// (not the matched text) are what flows into the summary/differential —
// this is what makes Tamil input produce an English report for free.
const SYMPTOM_KEYWORDS = {
  fever: ['fever', 'high temperature', 'chills', 'காய்ச்சல்'],
  cough: ['cough', 'coughing', 'இருமல்'],
  soreThroat: ['sore throat', 'throat pain', 'தொண்டை வலி'],
  headache: ['headache', 'migraine', 'தலைவலி'],
  fatigue: ['tired', 'fatigue', 'exhausted', 'weak', 'சோர்வு', 'களைப்பு'],
  chestPain: ['chest pain', 'chest tightness', 'மார்பு வலி'],
  breathlessness: ['short of breath', 'breathless', 'difficulty breathing', 'மூச்சு திணறல்', 'மூச்சு வாங்குது'],
  nausea: ['nausea', 'vomit', 'throwing up', 'குமட்டல்', 'வாந்தி'],
  dizziness: ['dizzy', 'dizziness', 'lightheaded', 'தலைசுற்றல்'],
  abdominalPain: ['stomach pain', 'abdominal pain', 'belly ache', 'வயிற்று வலி'],
};

const CONDITION_RULES = [
  { symptoms: ['fever', 'cough'], condition: 'Upper respiratory tract infection', confidence: 'medium' },
  { symptoms: ['fever', 'breathlessness'], condition: 'Lower respiratory infection — needs exam', confidence: 'medium' },
  { symptoms: ['chestPain', 'breathlessness'], condition: 'Cardiac or pulmonary cause of chest pain — urgent workup', confidence: 'medium' },
  { symptoms: ['headache', 'nausea'], condition: 'Migraine or vestibular cause', confidence: 'low' },
  { symptoms: ['dizziness', 'nausea'], condition: 'Vestibular or inner-ear cause', confidence: 'low' },
  { symptoms: ['abdominalPain', 'nausea'], condition: 'Gastrointestinal illness', confidence: 'low' },
  { symptoms: ['fatigue'], condition: 'Non-specific fatigue — consider anemia, thyroid, sleep', confidence: 'low' },
];

// English negates before the symptom ("no chest pain"); Tamil typically
// negates after it ("மார்பு வலி இல்லை" — chest pain, none). So negation is
// checked on both sides of the match, not just the preceding window.
const NEGATIONS_BEFORE = ['no ', 'not ', 'denies', 'denied', 'without ', 'negative for'];
const NEGATIONS_AFTER = ['இல்லை', 'இல்ல', 'கிடையாது'];

function isNegated(lower, matchIndex, keywordLength) {
  const before = lower.slice(Math.max(0, matchIndex - 25), matchIndex);
  const after = lower.slice(matchIndex + keywordLength, matchIndex + keywordLength + 15);
  return NEGATIONS_BEFORE.some((n) => before.includes(n)) || NEGATIONS_AFTER.some((n) => after.includes(n));
}

// Scans every occurrence of a keyword, not just the first, so "no chest pain,
// but severe headache" still catches the headache even though the first
// mention in the sentence is negated.
function matchesPositively(lower, keyword) {
  let idx = lower.indexOf(keyword);
  while (idx !== -1) {
    if (!isNegated(lower, idx, keyword.length)) return true;
    idx = lower.indexOf(keyword, idx + keyword.length);
  }
  return false;
}

function detectSymptoms(text) {
  const lower = text.toLowerCase();
  return Object.entries(SYMPTOM_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => matchesPositively(lower, k)))
    .map(([key]) => key);
}

function analyzeWithHeuristics(consultation) {
  const text = patientText(consultation);
  const detected = detectSymptoms(text);
  const readableSymptoms = detected.map((d) => d.replace(/([A-Z])/g, ' $1').toLowerCase());

  const differential = CONDITION_RULES
    .filter((rule) => rule.symptoms.every((s) => detected.includes(s)))
    .map((rule) => ({
      condition: rule.condition,
      confidence: rule.confidence,
      rationale: `Based on mentioned symptoms: ${rule.symptoms.join(', ')}.`,
    }));
  const resolvedDifferential = differential.length
    ? differential
    : [{ condition: 'Insufficient information for a differential', confidence: 'low', rationale: 'Add more transcript detail or vitals.' }];

  const vitalsFlags = [];
  for (const v of consultation.vitals) {
    if (v.type === 'spo2' && Number(v.value) < 95) vitalsFlags.push(`low SpO2 (${v.value}%) — consider respiratory causes`);
    if (v.type === 'temp' && Number(v.value) >= 37.8) vitalsFlags.push(`elevated temperature (${v.value}°C)`);
    if (v.type === 'pulse' && (Number(v.value) > 100 || Number(v.value) < 50)) vitalsFlags.push(`pulse of ${v.value} bpm outside typical resting range`);
  }

  const subjective = readableSymptoms.length
    ? `Patient reports ${readableSymptoms.join(', ')}.`
    : 'No symptoms clearly detected from the transcript yet — add more conversation detail for a stronger draft.';

  const objectiveBase = consultation.vitals.length
    ? `Vitals recorded — ${consultation.vitals.map((v) => `${v.type.toUpperCase()}: ${v.value}${v.unit} (${v.source})`).join('; ')}.`
    : 'No vitals recorded this visit.';
  const objective = vitalsFlags.length ? `${objectiveBase} Notable: ${vitalsFlags.join('; ')}.` : objectiveBase;

  const assessment = differential.length
    ? `Findings are most consistent with ${resolvedDifferential[0].condition.toLowerCase()}, pending physician confirmation.`
    : 'Insufficient information for a clinical impression yet.';

  const chiefComplaint = readableSymptoms.length ? readableSymptoms[0] : 'general consultation';

  return {
    chiefComplaint,
    subjective,
    objective,
    assessment,
    differential: resolvedDifferential,
    plan: [
      'Doctor to confirm history and physical findings before finalizing.',
      ...(vitalsFlags.length ? ['Re-check flagged vitals if clinically indicated.'] : []),
    ],
    suggestedQuestions: [
      'How long have these symptoms been present?',
      'Any known allergies or current medications?',
      'Has this happened before?',
    ],
    generatedBy: 'heuristic-fallback',
    generatedAt: new Date().toISOString(),
  };
}

async function analyzeWithLLM(consultation, patient, apiKey) {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  const userPrompt = `Patient: ${patient?.name ?? 'unknown'}, age ${patient?.age ?? 'unknown'}, history: ${patient?.historyNotes || 'none on file'}.
Vitals recorded this visit: ${vitalsSummary(consultation)}.
Transcript:
${transcriptText(consultation) || '(no transcript captured)'}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  return { ...parsed, generatedBy: 'llm', generatedAt: new Date().toISOString() };
}

export async function analyzeConsultation(consultation, patient) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      return await analyzeWithLLM(consultation, patient, apiKey);
    } catch (err) {
      console.error('LLM analysis failed, falling back to heuristics:', err.message);
    }
  }
  return analyzeWithHeuristics(consultation);
}

// Approximate, demo-level pronoun swap — "her" is ambiguous between object
// and possessive in English, so a real product would need proper NLP here.
// Good enough to demonstrate the "Smart Changes" concept offline.
function swapPronouns(text) {
  if (/\bhe\b|\bhim\b|\bhis\b/i.test(text)) {
    return text
      .replace(/\bhe\b/gi, (m) => (m === 'He' ? 'She' : 'she'))
      .replace(/\bhim\b/gi, (m) => (m === 'Him' ? 'Her' : 'her'))
      .replace(/\bhis\b/gi, (m) => (m === 'His' ? 'Her' : 'her'));
  }
  if (/\bshe\b|\bher\b/i.test(text)) {
    return text
      .replace(/\bshe\b/gi, (m) => (m === 'She' ? 'They' : 'they'))
      .replace(/\bher\b/gi, (m) => (m === 'Her' ? 'Their' : 'their'));
  }
  return text;
}

function refineWithHeuristics(draft, instructionKey) {
  const clone = { ...draft, plan: [...(draft.plan || [])] };
  switch (instructionKey) {
    case 'more-detailed':
      clone.assessment = `${clone.assessment} Consider correlating with prior visit history and any relevant labs or imaging on file.`;
      clone.plan.push('Expand history further at the next visit if symptoms persist.');
      break;
    case 'less-detailed':
      clone.subjective = clone.subjective.split('. ')[0] + '.';
      clone.objective = clone.objective.split('. ')[0] + '.';
      clone.assessment = clone.assessment.split('. ')[0] + '.';
      break;
    case 'add-billing-codes': {
      const top = draft.differential?.[0]?.condition || 'the presenting condition';
      clone.plan.push(`Consider appropriate ICD-10 coding for: ${top}.`);
      break;
    }
    case 'update-pronouns':
      clone.subjective = swapPronouns(clone.subjective);
      clone.objective = swapPronouns(clone.objective);
      clone.assessment = swapPronouns(clone.assessment);
      break;
    default:
      // Free-form instruction with no LLM key set — the offline heuristic
      // can't interpret arbitrary text, so record the request rather than
      // silently doing nothing.
      clone.plan.push(`Requested change (needs an LLM key to auto-apply): "${instructionKey}"`);
      break;
  }
  return { ...clone, generatedAt: new Date().toISOString() };
}

async function refineWithLLM(draft, instructionKey, apiKey) {
  const instructionText = INSTRUCTION_TEXT[instructionKey] || instructionKey;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: REFINE_SYSTEM_PROMPT },
        { role: 'user', content: `Instruction: ${instructionText}\n\nCurrent note JSON:\n${JSON.stringify(draft)}` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`LLM refine request failed: ${response.status}`);
  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content);
  return { ...draft, ...parsed, generatedAt: new Date().toISOString() };
}

export async function refineDraft(draft, instructionKey) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      return await refineWithLLM(draft, instructionKey, apiKey);
    } catch (err) {
      console.error('LLM refine failed, falling back to heuristics:', err.message);
    }
  }
  return refineWithHeuristics(draft, instructionKey);
}
