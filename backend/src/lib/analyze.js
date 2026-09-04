const SYSTEM_PROMPT = `You are a concise clinical documentation assistant supporting a licensed doctor after a consultation.
Analyze the complete doctor-patient conversation and return ONLY valid JSON.

Your job:
1. Extract problems/symptoms explicitly mentioned by the PATIENT. Include duration/severity only when stated.
   For each, include "quote": a short verbatim excerpt (under 12 words) copied EXACTLY from the conversation
   that shows the patient said this. Do not paraphrase the quote — copy the patient's actual words/spelling.
2. Suggest possible conditions/diseases that may fit the evidence. These are NOT confirmed diagnoses.
   Assign severity as mild, moderate, severe, or not_specified only from evidence in the conversation. Do not infer severe disease from a condition name alone.
   For each, include "evidenceQuote": a short verbatim excerpt (under 12 words) copied EXACTLY from the
   conversation that this condition is based on. If you cannot point to an exact excerpt that supports it,
   do NOT include that condition at all.
   When the patient describes ANY skin, rash, itching, swelling, hives, redness, dryness, or reaction-after-exposure
   symptom, actively consider (and include when evidence supports it) conditions such as: allergic contact dermatitis,
   atopic dermatitis/eczema, urticaria (hives), drug reaction, insect bite reaction, fungal skin infection, heat rash
   (miliaria), and — if breathing/swelling of face/lips/throat is mentioned alongside skin symptoms — possible
   anaphylaxis requiring urgent evaluation. If the evidence does not clearly match a specific named condition, still
   include one general entry such as "Possible allergic/dermatological reaction — unspecified type" with
   confidence "low" and an evidenceQuote, rather than omitting a skin-related finding entirely.
3. Suggest only relevant action items/investigations when the conversation reasonably supports them. Examples: CBC/blood test,
   urine test, ECG, X-ray, ultrasound, CT/MRI, monitoring, follow-up, specialist review. Never invent a doctor instruction.
4. Extract the next check-up/follow-up instruction if the doctor mentioned one. Otherwise use "Not specified".
5. Write a very short consultation summary (1-3 sentences).

The conversation may be Tamil, English, or Tamil-English mixed (including romanized Tamil / Thanglish spellings).
Understand code-switching. Return the output in English, but "quote" and "evidenceQuote" must be copied verbatim
from the original conversation text, in whatever language/script/spelling it was written in — do not translate or
correct spelling in these two fields.
Use only information supported by the conversation and supplied vitals. Never invent symptoms, history, medication, test results,
doctor instructions, dates, or diagnoses. If evidence is insufficient, say so.

Return ONLY this JSON shape:
{
  "chiefComplaint": "2-6 word main complaint",
  "querySummary": "1-3 sentence short summary",
  "patientProblems": [{"problem":"", "duration":"Not mentioned", "severity":"Not mentioned", "quote":""}],
  "predictedProblems": [{"label":"", "severity":"mild|moderate|severe|not_specified", "confidence":"low|medium|high", "rationale":"", "evidenceQuote":""}],
  "suggestedActionItems": [{"item":"", "source":"doctor_mentioned|ai_suggested"}],
  "nextCheckup": {"date":"", "instruction":"Not specified"}
}

A possible condition must be labeled as a possibility and must never be presented as a confirmed diagnosis.`;


const REFINE_SYSTEM_PROMPT = `You revise an existing clinical report draft based on a doctor's instruction.
Keep the exact same JSON shape you're given. Only change what the instruction asks for — never invent new
clinical findings that weren't already in the report.`;

const INSTRUCTION_TEXT = {
  'more-detailed': 'Make the query summary more detailed.',
  'less-detailed': 'Make the query summary more concise.',
  'add-billing-codes': 'Suggest relevant ICD-10 billing codes and add them as additional action items.',
  'update-pronouns': 'Update the pronouns used to refer to the patient.',
};

function transcriptText(consultation) {
  return consultation.transcript
    .map((t) => `${String(t.speaker || 'unknown').toUpperCase()}: ${t.text}`)
    .join('\n');
}

function patientTranscriptText(consultation) {
  const hasUndifferentiatedConversation = consultation.transcript.some((t) => t.speaker === 'conversation');
  return consultation.transcript
    .filter((t) => hasUndifferentiatedConversation || t.speaker === 'patient')
    .map((t) => t.text)
    .join('\n');
}

function vitalsSummary(consultation) {
  if (!consultation.vitals.length) return 'No vitals recorded.';
  return consultation.vitals.map((v) => `${v.type}: ${v.value}${v.unit} (${v.source})`).join(', ');
}

// Keys stay English regardless of which language matched, since the keys
// (not the matched text) are what flows into the summary/problems — this is
// what makes Tamil input produce an English report for free.
const SYMPTOM_KEYWORDS = {
  fever: ['fever', 'high temperature', 'chills', 'காய்ச்சல்'],
  cough: ['cough', 'coughing', 'இருமல்'],
  cold: ['cold', 'running nose', 'blocked nose', 'மூக்கு அடைப்பு', 'சளி'],
  soreThroat: ['sore throat', 'throat pain', 'தொண்டை வலி'],
  headache: ['headache', 'தலைவலி'],
  fatigue: ['tired', 'fatigue', 'exhausted', 'weak', 'சோர்வு', 'களைப்பு'],
  chestPain: ['chest pain', 'chest tightness', 'மார்பு வலி'],
  breathlessness: ['short of breath', 'breathless', 'difficulty breathing', 'மூச்சு திணறல்', 'மூச்சு வாங்குது'],
  nausea: ['nausea', 'குமட்டல்'],
  vomiting: ['vomit', 'vomiting', 'throwing up', 'வாந்தி'],
  diarrhea: ['diarrhea', 'diarrhoea', 'loose motion', 'loose stools', 'வயிற்றுப்போக்கு'],
  dizziness: ['dizzy', 'dizziness', 'lightheaded', 'தலைசுற்றல்'],
  abdominalPain: ['stomach pain', 'abdominal pain', 'belly ache', 'வயிற்று வலி'],

  // --- Skin / allergy related ---
  // Includes Tamil script AND common Thanglish/romanized-Tamil spellings
  // (e.g. "arikithu", "arikuthu") since patients/family members frequently
  // type Tamil using the Latin alphabet rather than Tamil script.
  skinRash: ['rash', 'skin rash', 'red patches', 'red spots', 'breakout', 'blister', 'blisters', 'bump', 'bumps', 'தோல் தடிப்பு', 'சிவப்பு தடிப்பு', 'thadippu'],
  itching: [
    'itch', 'itching', 'itchy',
    'அரிப்பு', 'சொறிச்சொறி',
    'arippu', 'arikkiruchu', 'arikiruchu', 'arikichu', 'arikkichu',
    'arikuthu', 'arikkuthu', 'arikithu', 'arikkithu', 'arikira', 'arikkira',
    'arikkum', 'arikum', 'sorichori', 'chorichori',
  ],
  hives: ['hives', 'welts', 'urticaria', 'படை படையாக வீக்கம்'],
  skinSwelling: ['skin swelling', 'swollen skin', 'face swelling', 'lip swelling', 'eye swelling', 'வீக்கம்', 'முகம் வீக்கம்', 'veekam'],
  skinDryness: ['dry skin', 'scaly skin', 'peeling skin', 'flaky skin', 'உலர் தோல்'],
  skinRedness: ['redness', 'red skin', 'burning skin', 'skin irritation', 'சிவந்து'],
  allergyTrigger: ['allergy', 'allergic', 'allergic reaction', 'new soap', 'new cream', 'new detergent', 'new food', 'insect bite', 'mosquito bite', 'ஒவ்வாமை', 'ovvamai'],
};

// Condition labels that are considered "skin/allergy" findings — used only
// for the heuristic fallback's own rule set, not for LLM verification.
const SKIN_ALLERGY_LABEL_HINTS = ['skin', 'allerg', 'dermat', 'urticaria', 'hives', 'rash', 'itch', 'eczema'];

// Any symptom key in this set counts as "some skin/allergy evidence was
// present" for the general catch-all below, even if none of the specific
// CONDITION_RULES combos matched.
const SKIN_ALLERGY_SYMPTOM_KEYS = ['skinRash', 'itching', 'hives', 'skinSwelling', 'skinDryness', 'skinRedness', 'allergyTrigger'];

// --- General-purpose grounding check (works for ANY term, not a fixed list) ---
//
// Instead of maintaining a dictionary of "suspicious" diagnosis words (which
// only ever covers terms we already thought of), we make the model attach a
// short verbatim quote to every predicted condition (see SYSTEM_PROMPT) and
// then verify that quote actually occurs in the real transcript. A model can
// still lie about a quote, but a small model asked to fabricate both a
// diagnosis AND a matching verbatim excerpt tends to fail more visibly
// (either it skips the field, echoes generic filler, or the quote plainly
// doesn't appear) than when just asked to name a condition.
function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Exact-substring match first; if that fails, fall back to a token-overlap
// ratio so minor rewording/typos in the "quote" don't fail a genuinely real
// excerpt (small models sometimes drop a filler word when quoting).
function quoteIsGrounded(quote, transcriptNormalized, { minOverlap = 0.7 } = {}) {
  const q = normalizeForMatch(quote);
  if (!q || q.length < 3) return false; // empty/near-empty "quote" proves nothing
  if (transcriptNormalized.includes(q)) return true;

  const quoteTokens = q.split(' ').filter(Boolean);
  if (!quoteTokens.length) return false;
  const matched = quoteTokens.filter((tok) => transcriptNormalized.includes(tok));
  return matched.length / quoteTokens.length >= minOverlap;
}

function detectSymptoms(text) {
  const lower = text.toLowerCase();
  return Object.entries(SYMPTOM_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => matchesPositively(lower, k)))
    .map(([key]) => key);
}

// Safety net for the small local model: verify every predicted condition
// against real transcript text rather than trusting the model's word.
//   1. If it supplied an evidenceQuote, that quote must actually appear
//      (fuzzy-matched) in the transcript — this catches hallucinated
//      conditions for ANY term, since it doesn't depend on knowing the
//      condition name in advance.
//   2. If it didn't supply a usable evidenceQuote at all, that's itself a
//      red flag for a model that was explicitly instructed to include one —
//      treat as unverified rather than silently accepting it.
// Unverified findings are kept (a doctor may still want to see them) but
// demoted to low confidence with a visible note, instead of being presented
// with whatever confidence the model itself assigned.
function verifyPredictedProblems(predictedProblems, fullTranscriptText) {
  if (!Array.isArray(predictedProblems) || !predictedProblems.length) return predictedProblems;
  const transcriptNormalized = normalizeForMatch(fullTranscriptText);

  return predictedProblems.map((p) => {
    const grounded = quoteIsGrounded(p.evidenceQuote, transcriptNormalized);
    if (grounded) return p;

    return {
      ...p,
      confidence: 'low',
      severity: p.severity === 'severe' ? 'not_specified' : p.severity,
      rationale: `Unverified — the model did not provide a quote from the conversation that could be matched to this finding. Review directly with the patient before acting on it. Original rationale: ${p.rationale || 'none given'}.`,
    };
  });
}

// If the model returned zero predicted problems but the deterministic
// keyword detector still found skin/allergy evidence in what the patient
// said, don't let the report go silent on it — add one general, clearly
// low-confidence entry so the doctor at least sees "something skin/allergy
// related was mentioned" instead of nothing. This is the general fallback
// that covers inputs/phrasings the model (or the rule list) wasn't
// specifically trained/written for.
function addGeneralConditionIfMissing(predictedProblems, detectedSymptomKeys, patientText) {
  const list = Array.isArray(predictedProblems) ? predictedProblems : [];
  const hasSkinAllergyEvidence = detectedSymptomKeys.some((k) => SKIN_ALLERGY_SYMPTOM_KEYS.includes(k));
  const alreadyCovered = list.some((p) => SKIN_ALLERGY_LABEL_HINTS.some((hint) => (p.label || '').toLowerCase().includes(hint)));

  if (!hasSkinAllergyEvidence || alreadyCovered) return list;

  // Find a short snippet of the patient's own words to use as the
  // evidenceQuote so this entry passes the same grounding check as any
  // model-generated one.
  const snippet = (patientText || '').trim().split(/\n+/).find(Boolean) || '';
  const evidenceQuote = snippet.split(/\s+/).slice(0, 10).join(' ');

  return [
    ...list,
    {
      label: 'Possible allergic/dermatological reaction — unspecified type',
      severity: 'not_specified',
      confidence: 'low',
      rationale: 'Patient described skin/itching/swelling-type symptoms that did not map to a more specific condition. Clinical examination needed to characterize further (e.g. contact dermatitis, urticaria, eczema, drug or insect-bite reaction).',
      evidenceQuote,
    },
  ];
}

const CONDITION_RULES = [
  { symptoms: ['fever', 'cough'], condition: 'Viral respiratory infection', confidence: 'medium' },
  { symptoms: ['cold', 'cough'], condition: 'Common cold / upper respiratory infection', confidence: 'medium' },
  { symptoms: ['fever', 'diarrhea'], condition: 'Viral gastroenteritis or other infection', confidence: 'low' },
  { symptoms: ['chestPain', 'breathlessness'], condition: 'Cardiac or pulmonary cause of chest pain — urgent evaluation may be needed', confidence: 'medium' },
  { symptoms: ['headache', 'nausea'], condition: 'Migraine or other headache disorder', confidence: 'low' },
  { symptoms: ['abdominalPain', 'nausea'], condition: 'Gastrointestinal illness', confidence: 'low' },

  // --- Skin / allergy related ---
  // More specific combinations first; the caller (below) takes the first
  // rule whose symptom set is a subset of what was detected and skips the
  // more general ones so the report doesn't list overlapping duplicates.
  { symptoms: ['hives', 'breathlessness'], condition: 'Possible severe allergic reaction (anaphylaxis) — urgent evaluation needed', confidence: 'medium' },
  { symptoms: ['skinSwelling', 'breathlessness'], condition: 'Possible severe allergic reaction (anaphylaxis) — urgent evaluation needed', confidence: 'medium' },
  { symptoms: ['hives'], condition: 'Urticaria (hives) — possible allergic reaction', confidence: 'medium' },
  { symptoms: ['skinRash', 'itching', 'allergyTrigger'], condition: 'Allergic contact dermatitis (skin allergy)', confidence: 'medium' },
  { symptoms: ['skinRash', 'itching'], condition: 'Allergic dermatitis / skin allergy', confidence: 'low' },
  { symptoms: ['skinRash'], condition: 'Skin rash of possible allergic or irritant origin', confidence: 'low' },
  { symptoms: ['itching'], condition: 'Pruritus (itching) — possible allergic or skin cause', confidence: 'low' },
  { symptoms: ['skinDryness', 'itching'], condition: 'Possible eczema / dry-skin dermatitis', confidence: 'low' },
  { symptoms: ['skinRedness'], condition: 'Skin irritation/redness — possible allergic or irritant cause', confidence: 'low' },
  { symptoms: ['allergyTrigger'], condition: 'Possible allergic reaction — general', confidence: 'low' },
];

const ACTION_ITEM_RULES = [
  { symptoms: ['fever'], item: 'Consider CBC/blood test if clinically indicated' },
  { symptoms: ['cough', 'breathlessness'], item: 'Consider chest X-ray if clinically indicated' },
  { symptoms: ['chestPain'], item: 'Consider ECG / urgent clinical evaluation' },
  { symptoms: ['abdominalPain', 'diarrhea'], item: 'Assess hydration; consider appropriate stool/blood testing if indicated' },
  { symptoms: ['dizziness'], item: 'Check blood pressure' },

  // --- Skin / allergy related ---
  { symptoms: ['skinRash', 'itching', 'hives', 'skinSwelling', 'skinDryness', 'skinRedness'], item: 'Examine skin lesions; note distribution, onset, and any recent new exposures (soap, food, medication, insect bite)' },
  { symptoms: ['skinRash', 'itching', 'allergyTrigger'], item: 'Consider allergy history review / patch testing if recurrent' },
  { symptoms: ['hives', 'skinSwelling'], item: 'Consider antihistamine trial and monitor for airway involvement' },
  { symptoms: ['hives', 'breathlessness', 'skinSwelling'], item: 'Urgent evaluation for anaphylaxis — monitor airway, breathing, circulation' },
];

const NEGATIONS_BEFORE = ['no ', 'not ', 'denies', 'denied', 'without ', 'negative for'];
const NEGATIONS_AFTER = ['இல்லை', 'இல்ல', 'கிடையாது'];

function isNegated(lower, matchIndex, keywordLength) {
  const before = lower.slice(Math.max(0, matchIndex - 30), matchIndex);
  const after = lower.slice(matchIndex + keywordLength, matchIndex + keywordLength + 18);
  return NEGATIONS_BEFORE.some((n) => before.includes(n)) || NEGATIONS_AFTER.some((n) => after.includes(n));
}

function matchesPositively(lower, keyword) {
  let idx = lower.indexOf(keyword);
  while (idx !== -1) {
    if (!isNegated(lower, idx, keyword.length)) return true;
    idx = lower.indexOf(keyword, idx + keyword.length);
  }
  return false;
}



function analyzeWithHeuristics(consultation) {
  // New consultations retain speaker tags, so only patient speech is used for
  // patient problems. Legacy untagged transcripts are scanned as a fallback.
  const patientText = patientTranscriptText(consultation);
  const text = patientText || transcriptText(consultation);
  const detected = detectSymptoms(text);
  const labels = {
    fever: 'Fever', cough: 'Cough', cold: 'Cold', soreThroat: 'Sore throat', headache: 'Headache',
    fatigue: 'Fatigue', chestPain: 'Chest pain', breathlessness: 'Breathlessness', nausea: 'Nausea',
    vomiting: 'Vomiting', diarrhea: 'Diarrhea', dizziness: 'Dizziness', abdominalPain: 'Abdominal pain',
    skinRash: 'Skin rash', itching: 'Itching', hives: 'Hives', skinSwelling: 'Skin/facial swelling',
    skinDryness: 'Dry/scaly skin', skinRedness: 'Skin redness/irritation', allergyTrigger: 'Possible allergy trigger reported',
  };

  const patientProblems = detected.map((key) => ({
    problem: labels[key],
    duration: 'Not mentioned',
    severity: 'Not mentioned',
  }));

  // Take each rule whose full symptom set was detected, but once a more
  // specific (longer) rule has claimed a symptom, don't also emit a shorter
  // rule that's a strict subset of it — avoids "Skin rash" AND "Allergic
  // dermatitis" both firing for the same underlying evidence.
  const matchedConditionRules = CONDITION_RULES
    .filter((rule) => rule.symptoms.every((symptom) => detected.includes(symptom)))
    .sort((a, b) => b.symptoms.length - a.symptoms.length);
  const claimedByLonger = [];
  let predictedProblems = matchedConditionRules
    .filter((rule) => {
      const isSubsetOfClaimed = claimedByLonger.some((longer) =>
        rule.symptoms.every((s) => longer.includes(s)) && rule.symptoms.length < longer.length
      );
      if (!isSubsetOfClaimed) claimedByLonger.push(rule.symptoms);
      return !isSubsetOfClaimed;
    })
    .map((rule) => ({
      label: rule.condition,
      severity: 'moderate',
      confidence: rule.confidence,
      rationale: `Based on patient-reported symptoms: ${rule.symptoms.map((s) => labels[s] || s).join(', ')}.`,
    }));

  // General catch-all: covers skin/allergy phrasing that matched a
  // SYMPTOM_KEYWORDS entry but, for whatever reason, didn't line up with any
  // CONDITION_RULES combo above (e.g. a symptom key not yet wired into a
  // rule). Keeps the report from going silent on "all variety of inputs".
  predictedProblems = addGeneralConditionIfMissing(predictedProblems, detected, patientText);

  const suggestedActionItems = ACTION_ITEM_RULES
    .filter((rule) => rule.symptoms.some((symptom) => detected.includes(symptom)))
    .map((rule) => ({ item: rule.item, source: 'ai_suggested' }));

  if (consultation.vitals.length) suggestedActionItems.push({ item: 'Review/recheck recorded vital signs as clinically indicated', source: 'ai_suggested' });

  const querySummary = patientProblems.length
    ? `Patient reports ${patientProblems.map((p) => p.problem.toLowerCase()).join(', ')}.`
    : 'No clear patient-reported problem was detected from the conversation.';

  const chiefComplaint = patientProblems[0]?.problem.toLowerCase() || 'general consultation';

  // Preserve an explicitly stated doctor follow-up when possible.
  const doctorText = consultation.transcript
    .filter((t) => t.speaker === 'doctor' || t.speaker === 'conversation')
    .map((t) => t.text)
    .join(' ');
  const followup = doctorText.match(/(?:come back|follow[- ]?up|review|check[- ]?up).{0,80}/i)?.[0]?.trim() || 'Not specified';

  return {
    chiefComplaint,
    querySummary,
    patientProblems,
    predictedProblems,
    suggestedActionItems,
    nextCheckup: { date: '', instruction: followup },
    subjective: querySummary,
    objective: vitalsSummary(consultation),
    assessment: predictedProblems.map((p) => `${p.label} (${p.confidence}) — ${p.rationale}`).join('\n') || 'No clear possible condition identified.',
    differential: predictedProblems.map((p) => ({ condition: p.label, confidence: p.confidence, rationale: p.rationale })),
    plan: suggestedActionItems.map((a) => `${a.item} [AI suggested]`),
    suggestedQuestions: [],
    generatedBy: 'heuristic-fallback',
    generatedAt: new Date().toISOString(),
  };
}

async function analyzeWithLLM(consultation, patient) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen3:1.7b';
  const userPrompt = `Patient age: ${patient?.age ?? 'unknown'}.
Patient history on file: ${patient?.historyNotes || 'none'}.
Vitals: ${vitalsSummary(consultation)}
Conversation:
${transcriptText(consultation) || '(no conversation captured)'}`;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0.1, num_predict: 500 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Local Qwen request failed: ${response.status}`);
  const data = await response.json();
  const content = data.message?.content;
  if (!content) throw new Error('Local Qwen returned an empty response');
  const parsed = JSON.parse(content);

  // Cross-check against the deterministic keyword detector before trusting
  // any hallucination-prone label — verifies every model-supplied
  // evidenceQuote actually appears in the real transcript.
  const patientText = patientTranscriptText(consultation) || transcriptText(consultation);
  let predictedProblems = verifyPredictedProblems(parsed.predictedProblems, patientText);

  // If the model still came back with nothing for a transcript that clearly
  // contains skin/allergy language, don't let it go silent — add the same
  // general catch-all used in the heuristic path.
  const detected = detectSymptoms(patientText);
  predictedProblems = addGeneralConditionIfMissing(predictedProblems, detected, patientText);

  return {
    ...parsed,
    predictedProblems,
    subjective: parsed.querySummary || '',
    objective: vitalsSummary(consultation),
    assessment: predictedProblems.map((p) => `${p.label} (${p.confidence}) — ${p.rationale}`).join('\n') || 'No clear possible condition identified.',
    differential: predictedProblems,
    plan: (parsed.suggestedActionItems || []).map((a) => typeof a === 'string' ? a : `${a.item} [${a.source === 'doctor_mentioned' ? 'Doctor mentioned' : 'AI suggested'}]`),
    suggestedQuestions: [],
    generatedBy: 'qwen3-local',
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzeConsultation(consultation, patient) {
  // Local-first: patient data never needs to leave the machine.
  try {
    return await analyzeWithLLM(consultation, patient);
  } catch (err) {
    console.error('Local Qwen analysis failed, falling back to heuristics:', err.message);
    return analyzeWithHeuristics(consultation);
  }
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
  const clone = { ...draft, actionItems: [...(draft.actionItems || [])] };
  switch (instructionKey) {
    case 'more-detailed':
      clone.querySummary = `${clone.querySummary} Consider correlating with prior visit history and any relevant labs or imaging on file.`;
      break;
    case 'less-detailed':
      clone.querySummary = clone.querySummary.split('. ')[0] + '.';
      break;
    case 'add-billing-codes': {
      const top = draft.problems?.[0] || draft.predictedProblems?.[0]?.label || 'the presenting condition';
      clone.actionItems.push(`Consider appropriate ICD-10 coding for: ${top}.`);
      break;
    }
    case 'update-pronouns':
      clone.querySummary = swapPronouns(clone.querySummary);
      break;
    default:
      // Free-form instruction with no LLM key set — the offline heuristic
      // can't interpret arbitrary text, so record the request rather than
      // silently doing nothing.
      clone.actionItems.push(`Requested change (needs an LLM key to auto-apply): "${instructionKey}"`);
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
        { role: 'user', content: `Instruction: ${instructionText}\n\nCurrent report JSON:\n${JSON.stringify(draft)}` },
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