import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { api } from '../api';
import type { Consultation, ReportDraft, Speaker } from '../types';
import { normalizeDraft } from '../types';
import { demoConversation, demoVitals } from '../demo/demoScript';

export default function ConsultationPage() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [speaker, setSpeaker] = useState<Speaker>('doctor');
  const [text, setText] = useState('');
  const [vitalType, setVitalType] = useState<'spo2' | 'pulse' | 'temp'>('spo2');
  const [vitalValue, setVitalValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailResult, setEmailResult] = useState<{ sent: boolean; preview: boolean; to: string; body?: string } | null>(null);
  const [voiceLang, setVoiceLang] = useState<'ta-IN' | 'en-IN'>('ta-IN');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const demoRunning = useRef(false);
  const recognitionRef = useRef<any>(null);
  const speakerRef = useRef<Speaker>(speaker);
  const consultationIdRef = useRef(consultationId);

  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  useEffect(() => {
    consultationIdRef.current = consultationId;
  }, [consultationId]);

  async function refresh() {
    if (!consultationId) return;
    const c = await api.getConsultation(consultationId);
    setConsultation(c);
    if (c.finalReport) setDraft(normalizeDraft(c.finalReport));
    else if (c.aiDraft) setDraft(normalizeDraft(c.aiDraft));
  }

  useEffect(() => {
    refresh();
    return () => recognitionRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  function startListening() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceError('Speech recognition is not supported in this browser — try Chrome or Edge.');
      return;
    }
    setVoiceError('');
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = voiceLang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const spokenText = result[0].transcript.trim();
          const id = consultationIdRef.current;
          if (spokenText && id) {
            api.addTranscriptLine(id, speakerRef.current, spokenText).then(refresh);
          }
        }
      }
    };
    recognition.onerror = (event: any) => {
      setVoiceError(`Voice recognition error: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    if (!consultationId || !text.trim()) return;
    await api.addTranscriptLine(consultationId, speaker, text.trim());
    setText('');
    await refresh();
  }

  async function handleAddVital(e: React.FormEvent) {
    e.preventDefault();
    if (!consultationId || !vitalValue) return;
    const units: Record<string, string> = { spo2: '%', pulse: 'bpm', temp: '°C' };
    await api.addVital(consultationId, { type: vitalType, value: Number(vitalValue), unit: units[vitalType], source: 'manual' });
    setVitalValue('');
    await refresh();
  }

  async function runDemoMode() {
    if (!consultationId || demoRunning.current) return;
    demoRunning.current = true;
    for (const v of demoVitals) {
      await api.addVital(consultationId, { ...v, source: 'device' });
    }
    for (const line of demoConversation) {
      await api.addTranscriptLine(consultationId, line.speaker, line.text);
      await refresh();
      await new Promise((r) => setTimeout(r, 500));
    }
    demoRunning.current = false;
  }

  async function handleEndConsultation() {
    if (!consultationId) return;
    setBusy(true);
    setError('');
    try {
      const c = await api.endConsultation(consultationId);
      setConsultation(c);
      setDraft(normalizeDraft(c.aiDraft));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!consultationId || !draft) return;
    setBusy(true);
    setError('');
    try {
      const c = await api.approveConsultation(consultationId, draft);
      setConsultation(c);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadPdf() {
    if (!consultation || !draft) return;
    const doc = new jsPDF();
    let y = 15;
    const line = (value: string, size = 11) => {
      doc.setFontSize(size);
      const split = doc.splitTextToSize(value, 180);
      doc.text(split, 15, y);
      y += split.length * (size / 2) + 4;
    };
    line('Consultation Report', 16);
    line(`Doctor: ${consultation.doctorName}`);
    line(`Date: ${new Date(consultation.startedAt).toLocaleString()}`);
    line(' ');
    line('Subjective:', 13);
    line(draft.subjective || '(none)');
    line(' ');
    line('Objective:', 13);
    line(draft.objective || '(none)');
    line(' ');
    line('Assessment:', 13);
    line(draft.assessment || '(none)');
    line(' ');
    line('Differential (for physician review only):', 13);
    draft.differential.forEach((d) => line(`- ${d.condition} [${d.confidence}] — ${d.rationale}`));
    line(' ');
    line('Plan:', 13);
    draft.plan.forEach((a) => line(`- ${a}`));
    doc.save(`consultation-report-${consultation.id}.pdf`);
  }

  async function handleSendEmail() {
    if (!consultationId) return;
    setBusy(true);
    try {
      const result = await api.emailReport(consultationId, emailTo || undefined);
      setEmailResult(result);
    } finally {
      setBusy(false);
    }
  }

  if (!consultation) return <p>Loading…</p>;

  return (
    <div className="consultation-page">
      {error && <p className="error-text">{error}</p>}

      {consultation.status === 'active' && (
        <>
          <section className="panel">
            <div className="consult-header">
              <div>
                <h2>Live consultation</h2>
                <p className={`consult-sub ${listening ? 'live' : ''}`}>{listening ? 'Listening…' : 'Not recording'}</p>
              </div>
              <button type="button" className="ghost" onClick={runDemoMode}>
                Demo mode
              </button>
            </div>

            <div className="chat-thread">
              {consultation.transcript.map((t, i) => (
                <div key={i} className={`bubble ${t.speaker}`}>
                  <span className="bubble-tag">{t.speaker}</span>
                  {t.text}
                </div>
              ))}
              {!consultation.transcript.length && <p className="empty-hint">No conversation captured yet.</p>}
            </div>

            <form className="composer" onSubmit={handleAddLine}>
              <select value={speaker} onChange={(e) => setSpeaker(e.target.value as Speaker)}>
                <option value="doctor">Doctor</option>
                <option value="patient">Patient</option>
              </select>
              <input placeholder="Type what was said…" value={text} onChange={(e) => setText(e.target.value)} />
              <button type="submit">Send</button>
            </form>

            <div className="mic-row">
              <select value={voiceLang} onChange={(e) => setVoiceLang(e.target.value as 'ta-IN' | 'en-IN')} disabled={listening}>
                <option value="ta-IN">Tamil</option>
                <option value="en-IN">English</option>
              </select>
              {!listening ? (
                <button type="button" className="mic-button" onClick={startListening}>
                  🎤 Start ambient listening as {speaker}
                </button>
              ) : (
                <button type="button" className="mic-button listening" onClick={stopListening}>
                  ⏹ Stop listening ({speaker} · {voiceLang === 'ta-IN' ? 'Tamil' : 'English'})
                </button>
              )}
            </div>
            {voiceError && <p className="error-text">{voiceError}</p>}
            <p className="hint-text">
              Voice capture uses the browser's built-in speech recognition (Chrome/Edge) — recognized speech is
              appended as a line for whichever speaker is selected above. Switch the speaker dropdown between turns.
            </p>
          </section>

          <section className="panel">
            <h2>Vitals</h2>
            <p className="hint-text">
              Manual entry below, or a paired device can POST directly to <code>/api/consultations/{consultation.id}/vitals</code>.
            </p>
            <div className="stat-tiles">
              {consultation.vitals.map((v, i) => (
                <div key={i} className="stat-tile">
                  <span className="stat-tile-label">{v.type}</span>
                  <span className="stat-tile-value">
                    {v.value}
                    <span className="stat-tile-unit">{v.unit}</span>
                  </span>
                  <span className="tag">{v.source}</span>
                </div>
              ))}
              {!consultation.vitals.length && <p className="empty-hint">No vitals recorded yet.</p>}
            </div>
            <form className="form-row" onSubmit={handleAddVital}>
              <select value={vitalType} onChange={(e) => setVitalType(e.target.value as typeof vitalType)}>
                <option value="spo2">SpO2 (%)</option>
                <option value="pulse">Pulse (bpm)</option>
                <option value="temp">Temperature (°C)</option>
              </select>
              <input placeholder="Value" value={vitalValue} onChange={(e) => setVitalValue(e.target.value)} inputMode="decimal" />
              <button type="submit">Add reading</button>
            </form>
          </section>

          <button className="primary end-button" disabled={busy} onClick={handleEndConsultation}>
            {busy ? 'Generating draft…' : 'End consultation & generate AI draft'}
          </button>
        </>
      )}

      {consultation.status !== 'active' && draft && (
        <section className="panel soap-card">
          <div className="letterhead">
            <div>
              <h2>{consultation.status === 'approved' ? 'Approved report' : 'AI draft — review before approving'}</h2>
              <p className="consult-sub">
                {consultation.doctorName} · {new Date(consultation.startedAt).toLocaleDateString()}
              </p>
            </div>
            <span className="badge">{draft.generatedBy === 'llm' ? 'LLM analysis' : 'Offline heuristic'}</span>
          </div>

          <div className="soap-body">
            <p className="hint-text">This is decision support only — confirm or edit everything before approving.</p>

            <div className="soap-section">
              <h3>Subjective</h3>
              <textarea
                value={draft.subjective}
                disabled={consultation.status === 'approved'}
                onChange={(e) => setDraft({ ...draft, subjective: e.target.value })}
              />
            </div>

            <div className="soap-section">
              <h3>Objective</h3>
              <textarea
                value={draft.objective}
                disabled={consultation.status === 'approved'}
                onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
              />
            </div>

            <div className="soap-section">
              <h3>Assessment</h3>
              <textarea
                value={draft.assessment}
                disabled={consultation.status === 'approved'}
                onChange={(e) => setDraft({ ...draft, assessment: e.target.value })}
              />
              <label className="field-label">Differential (for physician review only)</label>
              <ul className="differential-list">
                {draft.differential.map((d, i) => (
                  <li key={i} className={`confidence-${d.confidence}`}>
                    <strong>{d.condition}</strong> <span className="tag">{d.confidence}</span>
                    <p>{d.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="soap-section">
              <h3>Plan</h3>
              <ul className="plain-list">
                {draft.plan.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            {consultation.status === 'review' && (
              <button className="primary" disabled={busy} onClick={handleApprove}>
                Approve report
              </button>
            )}

            {consultation.status === 'approved' && (
              <div className="export-row">
                <button onClick={handleDownloadPdf}>Download PDF</button>
                <input placeholder="Send to email (optional)" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
                <button disabled={busy} onClick={handleSendEmail}>
                  Send email
                </button>
              </div>
            )}

            {emailResult && (
              <div className="email-result">
                {emailResult.sent ? (
                  <p>Email sent to {emailResult.to}.</p>
                ) : (
                  <>
                    <p>SMTP not configured — preview of the email that would be sent to {emailResult.to}:</p>
                    <pre>{emailResult.body}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <button className="link-button" onClick={() => navigate('/')}>
        &larr; Back to dashboard
      </button>
    </div>
  );
}
