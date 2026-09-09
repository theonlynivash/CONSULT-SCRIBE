import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { api } from '../api';
import type { Consultation, ReportDraft, PatientProblem, ActionItem, Patient } from '../types';
import { normalizeDraft } from '../types';
import { demoConversation, demoVitals } from '../demo/demoScript';
import { useAuth } from '../auth';

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19v-7" />
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M8 22h8" />
    </svg>
  );
}




export default function ConsultationPage() {
  const { user } = useAuth();
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitalType, setVitalType] = useState<'spo2' | 'pulse' | 'temp'>('spo2');
  const [vitalValue, setVitalValue] = useState('');
  const [includeVitals, setIncludeVitals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [reviewTab, setReviewTab] = useState<'summary' | 'problems' | 'conditions' | 'actions' | 'checkup'>('summary');
  const [emailTo, setEmailTo] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailResult, setEmailResult] = useState<{ sent: boolean; preview: boolean; to: string; body?: string; error?: string } | null>(null);
  const [voiceLang, setVoiceLang] = useState<'ta-IN' | 'en-IN'>('ta-IN');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceMode, setVoiceMode] = useState<'chrome' | 'grok' | null>(null);
  const demoRunning = useRef(false);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const consultationIdRef = useRef(consultationId);
  const grokRecorderRef = useRef<MediaRecorder | null>(null);
  const grokStreamRef = useRef<MediaStream | null>(null);
  const grokTimerRef = useRef<number | null>(null);
  const grokStoppingRef = useRef(false);

  useEffect(() => {
    consultationIdRef.current = consultationId;
  }, [consultationId]);

  async function refresh() {
    if (!consultationId) return;
    const c = await api.getConsultation(consultationId);
    setConsultation(c);
    if (c.patientId) {
      try {
        const patientRecord = await api.getPatient(c.patientId);
        setPatient(patientRecord);
        if (!emailTo && patientRecord.email) setEmailTo(patientRecord.email);
      } catch {
        
      }
    }
    if (c.finalReport) setDraft(normalizeDraft(c.finalReport));
    else if (c.aiDraft) setDraft(normalizeDraft(c.aiDraft));
  }

  useEffect(() => {
    refresh();
    return () => {
      listeningRef.current = false;
      const rec = recognitionRef.current;
      if (rec) {
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        try {
          rec.stop();
        } catch {
          
        }
      }
      grokStoppingRef.current = true;
      cleanupGrokRecorder();
    };
    
  }, [consultationId]);

  function isLikelyMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
    return Boolean(
      uaData?.mobile ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
    );
  }

  function clearGrokTimer() {
    if (grokTimerRef.current !== null) {
      window.clearTimeout(grokTimerRef.current);
      grokTimerRef.current = null;
    }
  }

  function cleanupGrokRecorder() {
    clearGrokTimer();
    const recorder = grokRecorderRef.current;
    grokRecorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        
      }
    }

    const stream = grokStreamRef.current;
    grokStreamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }

  async function uploadGrokSegment(blob: Blob) {
    const id = consultationIdRef.current;
    if (!id || !blob.size) return;

    try {
      const language = voiceLang === 'en-IN' ? 'en' : undefined;
      const result = await api.transcribeAudio(id, blob, language);
      const text = result.text.trim();

      if (text) {
        await api.addTranscriptLine(id, 'conversation', text);
        await refresh();
      }
    } catch (err) {
      if (listeningRef.current) {
        setVoiceError((err as Error).message || 'Grok could not transcribe this audio segment.');
      }
    }
  }

  async function startGrokRecording(showFallbackMessage = false) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      listeningRef.current = false;
      setListening(false);
      setVoiceMode(null);
      setVoiceError('This browser cannot record microphone audio for the Grok fallback. Please use a current Chrome, Edge, Safari, or Firefox browser.');
      return;
    }

    cleanupGrokRecorder();
    grokStoppingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!listeningRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      grokStreamRef.current = stream;
      grokRecorderRef.current = recorder;
      setVoiceMode('grok');
      setListening(true);
      if (showFallbackMessage) setVoiceError('');

      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };

      recorder.onerror = () => {
        if (!grokStoppingRef.current) {
          listeningRef.current = false;
          setListening(false);
          setVoiceMode(null);
          setVoiceError('Grok microphone recording failed. Check the browser microphone permission and try again.');
        }
      };

      recorder.onstop = async () => {
        clearGrokTimer();
        const segment = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        const shouldContinue = listeningRef.current && !grokStoppingRef.current;

        if (grokRecorderRef.current === recorder) {
          grokRecorderRef.current = null;
        }

        await uploadGrokSegment(segment);

        if (shouldContinue && listeningRef.current) {
          
          
          await startGrokRecording(false);
        } else {
          stream.getTracks().forEach((track) => track.stop());
          if (!listeningRef.current) setListening(false);
        }
      };

      recorder.start();

      
      
      
      grokTimerRef.current = window.setTimeout(() => {
        if (grokRecorderRef.current === recorder && recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            
          }
        }
      }, 15_000);
    } catch (err) {
      listeningRef.current = false;
      setListening(false);
      setVoiceMode(null);
      const message = (err as DOMException)?.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access in the browser settings and try again.'
        : (err as Error).message || 'Could not start Grok microphone recording.';
      setVoiceError(message);
    }
  }

  async function switchToGrokFallback(message?: string) {
    if (!listeningRef.current) return;

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.stop();
      } catch {
        
      }
    }

    if (message) setVoiceError(message);
    await startGrokRecording(Boolean(message));
  }

  async function startListening() {
    setVoiceError('');

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const useGrok = isLikelyMobileDevice() || !SpeechRecognitionCtor;

    listeningRef.current = true;
    setListening(true);

    if (useGrok) {
      await startGrokRecording(false);
      return;
    }

    setVoiceMode('chrome');
    beginRecognition(SpeechRecognitionCtor, voiceLang);
  }

  function beginRecognition(SpeechRecognitionCtor: new () => any, lang: string) {
    const prev = recognitionRef.current;
    if (prev) {
      prev.onend = null;
      prev.onerror = null;
      prev.onresult = null;
      try {
        prev.stop();
      } catch {
        
      }
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const spokenText = result[0].transcript.trim();
        const id = consultationIdRef.current;
        if (spokenText && id) {
          api.addTranscriptLine(id, 'conversation', spokenText).then(refresh).catch((err) => {
            setVoiceError((err as Error).message || 'Could not save the transcript.');
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      const err = String(event.error || '');

      if (err === 'no-speech' || err === 'aborted') return;

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        listeningRef.current = false;
        setListening(false);
        setVoiceMode(null);
        setVoiceError('Microphone permission was denied. Allow the mic in the browser address bar and try again.');
        return;
      }

      if (err === 'language-not-supported' && lang.startsWith('ta')) {
        setVoiceError('Tamil browser speech recognition is not available on this laptop — switched to English.');
        beginRecognition(SpeechRecognitionCtor, 'en-IN');
        return;
      }

      if (err === 'network') {
        void switchToGrokFallback('Chrome speech recognition lost its network connection. Switched to Grok STT fallback.');
        return;
      }

      if (err === 'audio-capture') {
        void switchToGrokFallback('Chrome could not keep the microphone capture alive. Switched to Grok STT fallback.');
        return;
      }

      void switchToGrokFallback('Chrome speech recognition stopped unexpectedly. Switched to Grok STT fallback.');
    };

    recognition.onend = () => {
      if (!listeningRef.current) {
        setListening(false);
        setVoiceMode(null);
        return;
      }

      window.setTimeout(() => {
        if (!listeningRef.current || recognitionRef.current !== recognition) return;
        try {
          recognition.start();
        } catch {
          beginRecognition(SpeechRecognitionCtor, lang);
        }
      }, 250);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      void switchToGrokFallback((err as Error).message || 'Could not start Chrome speech recognition. Switched to Grok STT fallback.');
    }
  }

  function stopListening() {
    listeningRef.current = false;
    setListening(false);
    setVoiceMode(null);
    grokStoppingRef.current = true;
    clearGrokTimer();

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.stop();
      } catch {
        
      }
    }

    const grokRecorder = grokRecorderRef.current;
    if (grokRecorder) {
      try {
        if (grokRecorder.state !== 'inactive') grokRecorder.stop();
      } catch {
        
      }
    } else {
      const stream = grokStreamRef.current;
      grokStreamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    }
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
      if (c.patientId) {
        try {
          const patientRecord = await api.getPatient(c.patientId);
          setPatient(patientRecord);
          if (!emailTo && patientRecord.email) setEmailTo(patientRecord.email);
        } catch {
          
        }
      }
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
      if (c.patientId) {
        try {
          const patientRecord = await api.getPatient(c.patientId);
          setPatient(patientRecord);
          if (!emailTo && patientRecord.email) setEmailTo(patientRecord.email);
        } catch {
          
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function buildReportPdf() {
    if (!consultation || !draft) return null;

    
    
    
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 11;
    const contentWidth = pageWidth - margin * 2;
    const gap = 7;
    const colWidth = (contentWidth - gap) / 2;
    const blue: [number, number, number] = [28, 76, 116];
    const ink: [number, number, number] = [20, 24, 28];
    const muted: [number, number, number] = [88, 96, 105];
    const border: [number, number, number] = [211, 218, 225];
    const lightBlue: [number, number, number] = [241, 246, 250];

    const workplaceName = user?.workplaceName?.trim() || 'Hospital / Clinic';
    const workplaceAddress = user?.workplaceAddress?.trim() || '';
    const workplaceContact = [user?.workplacePhone, user?.workplaceEmail].filter(Boolean).join('  •  ');
    const visit = new Date(consultation.startedAt);
    const visitText = `${visit.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}  •  ${visit.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    const patientName = patient?.name || 'Not recorded';
    const patientAge = patient?.age != null ? String(patient.age) : 'Not recorded';
    const patientSex = patient?.sex || 'Not recorded';
    const patientEmail = patient?.email || 'Not recorded';

    
    
    
    const confirmedActionItems = (draft.suggestedActionItems || [])
      .map((a: ActionItem) => a.item.trim())
      .filter(Boolean);

    const drawReport = (scale: number) => {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const sx = (v: number) => v * scale;
      let y = 9;
      let maxBottom = y;

      const wrap = (value: string, size: number, width: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sx(size));
        return doc.splitTextToSize((value || 'Not recorded').trim(), width);
      };
      const setBody = (size = 9.4) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sx(size));
        doc.setTextColor(...ink);
      };
      const section = (x: number, width: number, title: string, top: number) => {
        const h = sx(8.6);
        doc.setFillColor(...blue);
        doc.rect(x, top, width, h, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sx(9.1));
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), x + sx(3.1), top + sx(5.8));
        return top + h + sx(5.4);
      };
      const bullets = (items: string[], x: number, top: number, width: number, maxItems: number, maxLines = 3) => {
        let cy = top;
        setBody(9.2);
        for (const raw of items.slice(0, maxItems)) {
          const lines = wrap(raw, 9.2, width - sx(6)).slice(0, maxLines);
          doc.setFillColor(...blue);
          doc.circle(x + sx(1.5), cy - sx(1.3), sx(0.75), 'F');
          setBody(9.2);
          doc.text(lines, x + sx(4.2), cy);
          cy += Math.max(1, lines.length) * sx(4.5) + sx(2.8);
        }
        if (!items.length) {
          setBody(9.2);
          doc.text('Not recorded', x, cy);
          cy += sx(5.2);
        }
        return cy;
      };

      
      doc.setFillColor(...blue);
      doc.rect(0, 0, pageWidth, sx(3.2), 'F');
      if (user?.workplaceLogo) {
        try { doc.addImage(user.workplaceLogo, 'PNG', margin, y, sx(18), sx(18), undefined, 'FAST'); } catch {  }
      }
      const hx = user?.workplaceLogo ? margin + sx(23) : margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(sx(17));
      doc.setTextColor(...ink);
      doc.text(workplaceName, hx, y + sx(6.0));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(sx(9.3));
      doc.setTextColor(...muted);
      if (workplaceAddress) doc.text(wrap(workplaceAddress, 9.3, contentWidth - (hx - margin)).slice(0, 2), hx, y + sx(11.2));
      if (workplaceContact) doc.text(workplaceContact, hx, y + sx(17.0));
      y += sx(22);
      doc.setDrawColor(...border);
      doc.line(margin, y, pageWidth - margin, y);
      y += sx(6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(sx(16));
      doc.setTextColor(...ink);
      doc.text('CONSULTATION REPORT', margin, y + sx(5.5));
      y += sx(11);

      
      const cardH = sx(37);
      doc.setFillColor(...lightBlue);
      doc.setDrawColor(...border);
      doc.roundedRect(margin, y, contentWidth, cardH, sx(1.7), sx(1.7), 'FD');
      const px = margin + sx(4);
      const pw = (contentWidth - sx(8) - sx(7)) / 2;
      const patientField = (x: number, top: number, label: string, value: string, width: number) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(sx(7.2)); doc.setTextColor(...muted);
        doc.text(label.toUpperCase(), x, top);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(sx(10)); doc.setTextColor(...ink);
        const lines = wrap(value, 10, width).slice(0, 2);
        doc.text(lines, x, top + sx(5));
      };
      patientField(px, y + sx(7), 'Patient', patientName, pw);
      patientField(px + pw + sx(7), y + sx(7), 'Visit', visitText, pw);
      patientField(px, y + sx(18), 'Age / Sex', `${patientAge}  •  ${patientSex}`, pw);
      patientField(px + pw + sx(7), y + sx(18), 'Email', patientEmail, pw);
      y += cardH + sx(13);

      const leftX = margin;
      const rightX = margin + colWidth + gap;
      let ly = y;
      let ry = y;

      ly = section(leftX, colWidth, 'Patient Problems', ly);
      const problemItems = (draft.patientProblems || []).map((p: PatientProblem) => {
        const parts = [p.problem].filter(Boolean);
        if (p.severity && p.severity !== 'Not mentioned') parts.push(`Severity: ${p.severity}`);
        if (p.duration && p.duration !== 'Not mentioned') parts.push(p.duration);
        return parts.join('  •  ');
      }).filter(Boolean);
      ly = bullets(problemItems, leftX, ly, colWidth, 5, 3) + sx(4);

      ly = section(leftX, colWidth, 'Consultation Summary', ly);
      setBody(9.8);
      const summary = wrap(draft.querySummary || draft.subjective || 'No summary recorded.', 9.8, colWidth - sx(6)).slice(0, 7);
      doc.text(summary, leftX + sx(3), ly);
      ly += Math.max(1, summary.length) * sx(4.8) + sx(10);

      ly = section(leftX, colWidth, 'Objective / Vitals', ly);
      const objective =
        draft.objective ||
        (
          includeVitals && consultation.vitals.length
            ? consultation.vitals
                .map(v => `${v.type}: ${v.value}${v.unit}`)
                .join('  •  ')
            : 'No objective findings recorded.'
        );
      setBody(9.4);
      const objectiveLines = wrap(objective, 9.4, colWidth - sx(6)).slice(0, 5);
      doc.text(objectiveLines, leftX + sx(3), ly);
      ly += Math.max(1, objectiveLines.length) * sx(4.8) + sx(9);

      ry = section(rightX, colWidth, 'Predicted Disease', ry);
      const diseaseItems = (draft.predictedProblems || []).map((d: any) => {
        const severity = String(d.severity || 'moderate').replace(/_/g, ' ');
        const confidence = String(d.confidence || 'low');
        return `${d.label || 'Unspecified disease'}  •  ${severity} severity  •  ${confidence} confidence`;
      }).filter(Boolean);
      ry = bullets(diseaseItems, rightX, ry, colWidth, 4, 3) + sx(4);

      
      
      if (confirmedActionItems.length) {
        ry = section(rightX, colWidth, 'Action Items', ry);
        ry = bullets(confirmedActionItems, rightX, ry, colWidth, 6, 3) + sx(4);
      }

      ry = section(rightX, colWidth, 'Next Check-up', ry);
      const follow = draft.nextCheckup?.date
        ? `${draft.nextCheckup.date}  •  ${draft.nextCheckup.instruction || 'Follow-up'}`
        : (draft.nextCheckup?.instruction || 'Not specified');
      setBody(9.4);
      const followLines = wrap(follow, 9.4, colWidth - sx(6)).slice(0, 4);
      doc.text(followLines, rightX + sx(3), ry);
      ry += Math.max(1, followLines.length) * sx(4.8) + sx(9);

      maxBottom = Math.max(ly, ry);

      
      
      const noteY = maxBottom + sx(5);
      const noteText = draft.assessment || 'Clinical findings and recommendations for treating clinician review.';
      const noteLines = wrap(noteText, 8.8, contentWidth - sx(8)).slice(0, 5);
      const noteH = Math.max(sx(29), sx(14) + noteLines.length * sx(4.5));
      doc.setDrawColor(...border);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, noteY, contentWidth, noteH, sx(1.7), sx(1.7), 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(sx(7.2)); doc.setTextColor(...muted);
      doc.text('CLINICAL NOTE', margin + sx(3.5), noteY + sx(8));
      setBody(8.8);
      doc.text(noteLines, margin + sx(3.5), noteY + sx(14));

      maxBottom = noteY + noteH;

      doc.setDrawColor(...blue);
      doc.line(margin, pageHeight - sx(13), pageWidth - margin, pageHeight - sx(13));
      doc.setFont('helvetica', 'normal'); doc.setFontSize(sx(7.2)); doc.setTextColor(...muted);
      doc.text('Prepared for treating clinician review.', margin, pageHeight - sx(7.5));
      doc.text(`Patient: ${patientName}`, pageWidth / 2, pageHeight - sx(7.5), { align: 'center' });
      doc.text('Page 1 of 1', pageWidth - margin, pageHeight - sx(7.5), { align: 'right' });

      return { doc, bottom: maxBottom };
    };

    
    
    
    let scale = 1;
    let rendered = drawReport(scale);
    const usableBottom = pageHeight - 18;
    for (let i = 0; i < 4 && rendered.bottom > usableBottom; i += 1) {
      scale = Math.max(0.72, scale * (usableBottom / rendered.bottom) * 0.97);
      rendered = drawReport(scale);
    }

    return rendered.doc;
  }

  function handleDownloadPdf() {
    const doc = buildReportPdf();
    if (!doc || !consultation) return;
    doc.save(`consultation-report-${consultation.id}.pdf`);
  }

  async function handleSendEmail() {
    if (!consultationId) return;
    setBusy(true);
    setEmailError('');
    setEmailResult(null);
    try {
      const doc = buildReportPdf();
      if (!doc) throw new Error('Approved report is not ready.');
      const bytes = new Uint8Array(doc.output('arraybuffer'));
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const pdfBase64 = btoa(binary);
      const result = await api.emailReport(consultationId, emailTo.trim() || undefined, pdfBase64);
      setEmailResult(result);
      if (!result.sent) setEmailError(result.error || 'Email was not sent. Check SMTP settings in the backend .env file.');
    } catch (err) {
      setEmailError((err as Error).message || 'Email could not be sent.');
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
                <p className={`consult-sub ${listening ? 'live' : ''}`}>{listening ? (voiceMode === 'grok' ? 'Listening with Grok STT…' : 'Listening…') : 'Not recording'}</p>
              </div>
              <button type="button" className="ghost" onClick={runDemoMode}>
                Demo mode
              </button>
            </div>

            <div className="chat-thread">
              {consultation.transcript.map((t, i) => (
                <p key={i} className="transcript-line">
                  {t.text}
                </p>
              ))}
              {!consultation.transcript.length && <p className="empty-hint">No conversation captured yet.</p>}
            </div>

            <div className="conversation-start">
              <div>
                <strong>Start conversation</strong>
                <span>Keep the consultation as one continuous conversation. No doctor/patient switching is required.</span>
              </div>
              <select value={voiceLang} onChange={(e) => setVoiceLang(e.target.value as 'ta-IN' | 'en-IN')} disabled={listening} aria-label="Conversation language">
                <option value="ta-IN">Tamil</option>
                <option value="en-IN">English</option>
              </select>
              <button
                type="button"
                className={`mic-button conversation-mic${listening ? ' listening' : ''}`}
                onClick={listening ? stopListening : startListening}
                aria-label={listening ? 'Stop conversation' : 'Start conversation'}
              >
                <MicIcon />
                <span>{listening ? 'Stop conversation' : 'Start conversation'}</span>
              </button>
            </div>
            {voiceError && <p className="error-text">{voiceError}</p>}
            <p className="hint-text">
              Laptop: Chrome speech recognition is used normally. Mobile or unsupported browsers use Grok STT automatically, and Grok also takes over if Chrome speech recognition fails.
            </p>
          </section>

          <section className="panel vitals-panel">
            <div className="vitals-heading">
              <h2>Vitals</h2>

              <div className={`vitals-report-control ${includeVitals ? 'enabled' : ''}`}>
                <span className="vitals-report-control-label">
                  Include in report
                </span>

                <button
                  type="button"
                  className={`vitals-toggle ${includeVitals ? 'on' : ''}`}
                  onClick={() => setIncludeVitals((current) => !current)}
                  role="switch"
                  aria-checked={includeVitals}
                  aria-label="Include vitals in report"
                >
                  <span className="vitals-toggle-knob" />
                </button>
              </div>
            </div>

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
            {busy ? 'Generating draft…' : 'End consultation & generate clinical draft'}
          </button>
        </>
      )}

      {consultation.status !== 'active' && draft && (
        <section className="panel soap-card">
          <div className="letterhead">
            <div>
              <h2>{consultation.status === 'approved' ? 'Approved report' : 'Clinical consultation review'}</h2>
              <p className="consult-sub">{consultation.doctorName} · {new Date(consultation.startedAt).toLocaleDateString()}</p>
            </div>
            <span className="badge">Clinical draft</span>
          </div>

          <div className="review-warning">
            Review and confirm all clinical information before generating the PDF.
          </div>

          <div className="report-letterhead-preview">
            {user?.workplaceLogo ? (
              <img className="report-letterhead-logo" src={user.workplaceLogo} alt="Workplace logo" />
            ) : (
              <div className="report-letterhead-logo" aria-hidden="true">🏥</div>
            )}
            <div>
              <p className="report-letterhead-name">{user?.workplaceName || 'Report letterhead not configured'}</p>
              <p className="report-letterhead-meta">
                {user?.workplaceAddress || 'Add your hospital/clinic address in Settings'}
                {(user?.workplacePhone || user?.workplaceEmail) && <> · {[user.workplacePhone, user.workplaceEmail].filter(Boolean).join(' · ')}</>}
              </p>
            </div>
            <span className="report-letterhead-ready">PDF LETTERHEAD</span>
          </div>

          <div className="review-tabs" role="tablist">
            {([
              ['summary', 'Summary'],
              ['problems', 'Patient Problems'],
              ['conditions', 'Predicted Disease'],
              ['actions', 'Action Items'],
              ['checkup', 'Next Check-up'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" className={reviewTab === key ? 'active' : ''} onClick={() => setReviewTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="review-panel">
            {reviewTab === 'summary' && (
              <div className="soap-section">
                <h3>Short consultation summary</h3>
                <textarea
                  value={draft.querySummary || draft.subjective}
                  disabled={consultation.status === 'approved'}
                  onChange={(e) => setDraft({ ...draft, querySummary: e.target.value, subjective: e.target.value })}
                />
              </div>
            )}

            {reviewTab === 'problems' && (
              <div className="soap-section">
                <h3>Problems mentioned by patient</h3>
                {(draft.patientProblems || []).map((p, i) => (
                  <div className="review-item problem-row" key={i}>
                    <label><span>Problem</span><input value={p.problem} disabled={consultation.status === 'approved'} onChange={(e) => {
                      const items = [...(draft.patientProblems || [])]; items[i] = { ...items[i], problem: e.target.value }; setDraft({ ...draft, patientProblems: items });
                    }} /></label>
                    <label><span>Severity</span><input value={p.severity} placeholder="Not mentioned" disabled={consultation.status === 'approved'} onChange={(e) => {
                      const items = [...(draft.patientProblems || [])]; items[i] = { ...items[i], severity: e.target.value }; setDraft({ ...draft, patientProblems: items });
                    }} /></label>
                    <label><span>Duration</span><input value={p.duration} placeholder="Not mentioned" disabled={consultation.status === 'approved'} onChange={(e) => {
                      const items = [...(draft.patientProblems || [])]; items[i] = { ...items[i], duration: e.target.value }; setDraft({ ...draft, patientProblems: items });
                    }} /></label>
                    {consultation.status === 'review' && <button type="button" onClick={() => setDraft({ ...draft, patientProblems: (draft.patientProblems || []).filter((_, j) => j !== i) })}>Delete</button>}
                  </div>
                ))}
                {consultation.status === 'review' && <button type="button" className="secondary" onClick={() => setDraft({ ...draft, patientProblems: [...(draft.patientProblems || []), { problem: '', duration: 'Not mentioned', severity: 'Not mentioned' }] })}>+ Add problem</button>}
              </div>
            )}

            {reviewTab === 'conditions' && (
              <div className="soap-section">
                <h3>Predicted disease</h3>
                {(draft.predictedProblems || []).map((d, i) => (
                  <div className="review-condition" key={i}>
                    <div className="review-item disease-row">
                      <label><span>Disease predicted</span><input value={d.label} placeholder="Disease / condition" disabled={consultation.status === 'approved'} onChange={(e) => {
                        const items = [...(draft.predictedProblems || [])]; items[i] = { ...items[i], label: e.target.value }; setDraft({ ...draft, predictedProblems: items });
                      }} /></label>
                      <label><span>Severity</span><select value={d.severity || 'moderate'} disabled={consultation.status === 'approved'} onChange={(e) => {
                        const items = [...(draft.predictedProblems || [])]; items[i] = { ...items[i], severity: e.target.value as any }; setDraft({ ...draft, predictedProblems: items });
                      }}>
                        <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="not_specified">Not specified</option>
                      </select></label>
                      <label><span>Confidence</span><select value={d.confidence} disabled={consultation.status === 'approved'} onChange={(e) => {
                        const items = [...(draft.predictedProblems || [])]; items[i] = { ...items[i], confidence: e.target.value as 'low' | 'medium' | 'high' }; setDraft({ ...draft, predictedProblems: items });
                      }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                      {consultation.status === 'review' && <button type="button" onClick={() => setDraft({ ...draft, predictedProblems: (draft.predictedProblems || []).filter((_, j) => j !== i) })}>Delete</button>}
                    </div>
                    <label className="disease-rationale"><span>Clinical rationale</span><textarea value={d.rationale} disabled={consultation.status === 'approved'} onChange={(e) => {
                      const items = [...(draft.predictedProblems || [])]; items[i] = { ...items[i], rationale: e.target.value }; setDraft({ ...draft, predictedProblems: items });
                    }} /></label>
                  </div>
                ))}
                {!draft.predictedProblems?.length && <p className="empty-hint">No predicted disease identified.</p>}
                {consultation.status === 'review' && <button type="button" className="secondary" onClick={() => setDraft({ ...draft, predictedProblems: [...(draft.predictedProblems || []), { label: '', severity: 'moderate', confidence: 'low', rationale: '' }] })}>+ Add predicted disease</button>}
                <p className="hint-text">Possible conditions require clinician confirmation.</p>
              </div>
            )}

            {reviewTab === 'actions' && (
              <div className="soap-section">
                <h3>Action items / investigations</h3>
                {(draft.suggestedActionItems || []).map((a, i) => (
                  <div className="review-item" key={i}>
                    <input value={a.item} disabled={consultation.status === 'approved'} onChange={(e) => {
                      const items = [...(draft.suggestedActionItems || [])]; items[i] = { ...items[i], item: e.target.value }; setDraft({ ...draft, suggestedActionItems: items });
                    }} />
                    <select value={a.source} disabled={consultation.status === 'approved'} onChange={(e) => {
                      const items = [...(draft.suggestedActionItems || [])]; items[i] = { ...items[i], source: e.target.value as ActionItem['source'] }; setDraft({ ...draft, suggestedActionItems: items });
                    }}>
                      <option value="ai_suggested">AI suggested</option><option value="doctor_mentioned">Doctor mentioned</option>
                    </select>
                    {consultation.status === 'review' && <button type="button" onClick={() => setDraft({ ...draft, suggestedActionItems: (draft.suggestedActionItems || []).filter((_, j) => j !== i) })}>Delete</button>}
                  </div>
                ))}
                {consultation.status === 'review' && <button type="button" className="secondary" onClick={() => setDraft({ ...draft, suggestedActionItems: [...(draft.suggestedActionItems || []), { item: '', source: 'doctor_mentioned' }] })}>+ Add action</button>}
              </div>
            )}

            {reviewTab === 'checkup' && (
              <div className="soap-section">
                <h3>Next check-up</h3>
                <label className="field-label">Date</label>
                <input type="date" value={draft.nextCheckup?.date || ''} disabled={consultation.status === 'approved'} onChange={(e) => setDraft({ ...draft, nextCheckup: { ...(draft.nextCheckup || { instruction: '' }), date: e.target.value } })} />
                <label className="field-label">Follow-up instruction</label>
                <textarea value={draft.nextCheckup?.instruction || 'Not specified'} disabled={consultation.status === 'approved'} onChange={(e) => setDraft({ ...draft, nextCheckup: { ...(draft.nextCheckup || { date: '' }), instruction: e.target.value } })} />
              </div>
            )}
          </div>

          {consultation.status === 'review' && (
            <div className="export-row">
              <button className="primary" disabled={busy} onClick={handleApprove}>Confirm &amp; Generate PDF</button>
              <button disabled={busy} onClick={async () => { const c = await api.regenerateDraft(consultation.id); setDraft(normalizeDraft(c.aiDraft)); }}>Regenerate clinical analysis</button>
            </div>
          )}

          {consultation.status === 'approved' && (
            <div className="export-row">
              <button onClick={handleDownloadPdf}>Download PDF</button>
              <input placeholder="Patient email" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
              <button disabled={busy} onClick={handleSendEmail}>Send to patient</button>
            </div>
          )}

          {emailError && <p className="error-text">{emailError}</p>}

          {emailResult && (
            <div className="email-result">
              {emailResult.sent ? <p>Email sent successfully to <strong>{emailResult.to}</strong>.</p> : <><p>Email was not sent to <strong>{emailResult.to}</strong>.</p>{emailResult.error && <p>{emailResult.error}</p>}{emailResult.body && <details><summary>Preview report</summary><pre>{emailResult.body}</pre></details>}</>}
            </div>
          )}
        </section>
      )}

      <button className="link-button" onClick={() => navigate('/')}>
        &larr; Back to dashboard
      </button>
    </div>
  );
}
