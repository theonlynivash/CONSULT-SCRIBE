import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import type { Note, ReportDraft } from '../types';
import { normalizeDraft } from '../types';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H2a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3.65 8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8a1.7 1.7 0 0 0 1-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12Z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8v.01" />
    </svg>
  );
}

function ThumbIcon({ down }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={down ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path d="M7 10v10H4V10h3Zm0 0 4-8a2 2 0 0 1 2 2v5h5.3a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7" />
    </svg>
  );
}

const CHIPS: { key: string; label: string }[] = [
  { key: 'more-detailed', label: 'More detailed' },
  { key: 'less-detailed', label: 'Less detailed' },
  { key: 'add-billing-codes', label: 'Add billing codes' },
  { key: 'update-pronouns', label: 'Update pronouns' },
];

const NOTE_TYPES = ['Progress Note', 'Consult', 'H+P', 'Dictation', 'Meeting'];

// Informational only for now — nothing actually deletes a note after this
// many days. A real retention/deletion policy is a later, deliberate step,
// not something to fake as already enforced.
const RETENTION_DAYS = 30;

function weekdayTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function noteTitle(note: Note) {
  const complaint = note.finalReport?.chiefComplaint || note.aiDraft?.chiefComplaint;
  if (complaint) return `${note.patientName}, ${complaint}`;
  return `${note.patientName} — ${weekdayTime(note.startedAt)}`;
}

function durationLabel(note: Note) {
  if (!note.endedAt) return '';
  const mins = Math.max(1, Math.round((new Date(note.endedAt).getTime() - new Date(note.startedAt).getTime()) / 60000));
  return `${mins}m`;
}

function expiryLabel(note: Note) {
  const createdAt = new Date(note.startedAt).getTime();
  const daysLeft = Math.ceil((createdAt + RETENTION_DAYS * 86400000 - Date.now()) / 86400000);
  return daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired';
}

function dateGroup(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

export default function NotesPage() {
  const location = useLocation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [view, setView] = useState<'note' | 'transcript'>('note');
  const [noteType, setNoteType] = useState(NOTE_TYPES[0]);
  const [customInstruction, setCustomInstruction] = useState('');

  async function refresh(selectFirst = false) {
    const list = await api.listNotes();
    setNotes(list);
    if (selectFirst && list.length) setSelectedId(list[0].id);
  }

  useEffect(() => {
    refresh(true);
  }, []);

  // Arriving from the Scribe page's "Review report" / "View report" links
  // a specific note via router state — select it once its data has loaded.
  useEffect(() => {
    const wantId = (location.state as { selectId?: string } | null)?.selectId;
    if (wantId && notes.some((n) => n.id === wantId)) setSelectedId(wantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const selected = notes.find((n) => n.id === selectedId) || null;

  useEffect(() => {
    if (selected) {
      setDraft(normalizeDraft(selected.finalReport || selected.aiDraft));
      setEditing(false);
      setFeedbackGiven(null);
      setCopied(false);
      setView('note');
      setNoteType(NOTE_TYPES[0]);
      setCustomInstruction('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const grouped = notes.reduce<Record<string, Note[]>>((acc, n) => {
    const group = dateGroup(n.startedAt);
    (acc[group] ||= []).push(n);
    return acc;
  }, {});

  async function handleDelete(id: string) {
    if (!confirm('Delete this note permanently?')) return;
    await api.deleteNote(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  }

  async function handleCopy() {
    if (!draft) return;
    const text = [
      `Subjective: ${draft.subjective}`,
      `Objective: ${draft.objective}`,
      `Assessment: ${draft.assessment}`,
      `Differential: ${draft.differential.map((d) => `${d.condition} (${d.confidence})`).join('; ')}`,
      `Plan: ${draft.plan.join('; ')}`,
    ].join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleResume() {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await api.regenerateDraft(selected.id);
      setDraft(normalizeDraft(updated.aiDraft));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function applyInstruction(instruction: string) {
    if (!selected || !draft || !instruction.trim()) return;
    setBusy(true);
    try {
      const revised = await api.refineDraft(selected.id, draft, instruction);
      setDraft(normalizeDraft(revised));
    } finally {
      setBusy(false);
    }
  }

  async function handleCustomSubmit() {
    const instruction = customInstruction.trim();
    if (!instruction) return;
    await applyInstruction(instruction);
    setCustomInstruction('');
  }

  async function handleFeedback(rating: 'up' | 'down') {
    if (!selected) return;
    setFeedbackGiven(rating);
    await api.sendFeedback(selected.id, rating);
  }

  async function handleSave() {
    if (!selected || !draft) return;
    setBusy(true);
    try {
      await api.approveConsultation(selected.id, draft);
      setEditing(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notes-workspace">
      <aside className="notes-list">
        <div className="notes-list-header">
          <h2>Report</h2>
          <Link to="/scribe" className="take-notes-btn">
            <PlusIcon />
            Take Notes
          </Link>
        </div>
        <button type="button" className="template-settings-row" title="Coming soon">
          <GearIcon />
          Note Template Settings
        </button>

        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className="date-group-label">{group}</div>
            {items.map((n) => (
              <div key={n.id} className={`note-row ${n.id === selectedId ? 'active' : ''}`}>
                <button type="button" className="note-row-main" onClick={() => setSelectedId(n.id)}>
                  <span className="note-row-title">{noteTitle(n)}</span>
                  <span className="note-row-meta">
                    {new Date(n.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {durationLabel(n) ? ` · ${durationLabel(n)}` : ''}
                  </span>
                  <span className="note-row-expiry">{expiryLabel(n)}</span>
                </button>
                <button type="button" className="note-row-delete" title="Delete note" onClick={() => handleDelete(n.id)}>
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        ))}
        {!notes.length && <p className="empty-hint">No notes yet — end a consultation to generate one.</p>}
      </aside>

      <section className="notes-detail">
        {!selected && <p className="empty-hint">Select a note from the list.</p>}
        {selected && draft && (
          <>
            <div className="notes-detail-header">
              <h2>{noteTitle(selected)}</h2>
              <p className="consult-sub">
                {new Date(selected.startedAt).toLocaleString()}
                {durationLabel(selected) ? ` (${durationLabel(selected)})` : ''} · {expiryLabel(selected)}
              </p>
              <div className="view-tabs">
                <button type="button" className={view === 'note' ? 'active' : ''} onClick={() => setView('note')}>
                  Note
                </button>
                <button type="button" className={view === 'transcript' ? 'active' : ''} onClick={() => setView('transcript')}>
                  Transcript
                </button>
              </div>
            </div>

            {view === 'transcript' ? (
              <div className="chat-thread standalone">
                {selected.transcript.map((t, i) => (
                  <p key={i} className="transcript-line">
                    {t.text}
                  </p>
                ))}
                {!selected.transcript.length && <p className="empty-hint">No conversation captured for this note.</p>}
              </div>
            ) : (
              <>
                <div className="soap-section">
                  <h3>Subjective</h3>
                  {editing ? (
                    <textarea value={draft.subjective} onChange={(e) => setDraft({ ...draft, subjective: e.target.value })} />
                  ) : (
                    <p>{draft.subjective}</p>
                  )}
                </div>

                <div className="soap-section">
                  <h3>Objective</h3>
                  {editing ? (
                    <textarea value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} />
                  ) : (
                    <p>{draft.objective}</p>
                  )}
                </div>

                <div className="soap-section">
                  <h3>Assessment</h3>
                  {editing ? (
                    <textarea value={draft.assessment} onChange={(e) => setDraft({ ...draft, assessment: e.target.value })} />
                  ) : (
                    <p>{draft.assessment}</p>
                  )}
                  <ul className="differential-list">
                    {draft.differential.map((d, i) => (
                      <li key={i} className={`confidence-${d.confidence}`}>
                        <strong>{d.condition}</strong> <span className="tag">{d.confidence}</span>
                        <p>{d.rationale}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="soap-section report-patient-facing-section">
                  <h3>Patient Problems</h3>
                  {draft.patientProblems?.length ? (
                    <ul className="plain-list">
                      {draft.patientProblems.map((p, i) => (
                        <li key={i}><strong>{p.problem}</strong>{p.severity ? ` — ${p.severity}` : ''}{p.duration ? ` — ${p.duration}` : ''}</li>
                      ))}
                    </ul>
                  ) : <p>No patient problems recorded.</p>}
                </div>

                <div className="soap-section report-patient-facing-section">
                  <h3>Predicted Disease <span className="report-ai-label">AI suggestion — doctor approved</span></h3>
                  {draft.predictedProblems?.length ? (
                    <ul className="differential-list">
                      {draft.predictedProblems.map((d, i) => (
                        <li key={i}>
                          <strong>{d.label || 'Unspecified condition'}</strong>
                          <span className="tag">{d.confidence}</span>
                          <span className="tag">{d.severity}</span>
                          {d.rationale && <p>{d.rationale}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p>No predicted disease recorded.</p>}
                </div>

                <div className="soap-section report-patient-facing-section">
                  <h3>Approved Action Items</h3>
                  {draft.suggestedActionItems?.length ? (
                    <ul className="plain-list">
                      {draft.suggestedActionItems.map((a, i) => (
                        <li key={i}>{a.item}</li>
                      ))}
                    </ul>
                  ) : <p>No action items recorded.</p>}
                </div>

                <div className="soap-section report-patient-facing-section">
                  <h3>Next Check-up</h3>
                  <p>{draft.nextCheckup?.date ? `${draft.nextCheckup.date} — ` : ''}{draft.nextCheckup?.instruction || 'Not specified'}</p>
                </div>

                <div className="feedback-row">
                  <span>How did this note do?</span>
                  <button
                    type="button"
                    className={`ghost feedback-button ${feedbackGiven === 'up' ? 'active-feedback' : ''}`}
                    onClick={() => handleFeedback('up')}
                  >
                    <ThumbIcon />
                  </button>
                  <button
                    type="button"
                    className={`ghost feedback-button ${feedbackGiven === 'down' ? 'active-feedback' : ''}`}
                    onClick={() => handleFeedback('down')}
                  >
                    <ThumbIcon down />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      <aside className="notes-actions">
        <div className="notes-actions-header">
          <h3>Actions</h3>
          <InfoIcon />
        </div>
        <ul className="action-list">
          <li>
            <select className="note-type-select action-item" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </li>
          <li>
            <button
              type="button"
              className="action-item"
              disabled={!selected || selected.status === 'approved'}
              onClick={() => setEditing((e) => !e)}
            >
              <PencilIcon /> {editing ? 'Stop editing' : 'Edit note'}
            </button>
          </li>
          <li>
            <button type="button" className="action-item" disabled={!draft} onClick={handleCopy}>
              <CopyIcon /> {copied ? 'Copied!' : 'Copy note'}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="action-item"
              disabled={!selected || selected.status === 'approved' || busy}
              onClick={handleResume}
            >
              <ResumeIcon /> Resume note
            </button>
          </li>
          <li>
            <button type="button" className="action-item danger" disabled={!selected} onClick={() => selected && handleDelete(selected.id)}>
              <TrashIcon /> Delete note
            </button>
          </li>
        </ul>

        {selected && selected.status === 'review' && (
          <>
            <div className="notes-actions-header">
              <h3>Smart Changes</h3>
              <InfoIcon />
            </div>
            <div className="chip-row">
              {CHIPS.map((c) => (
                <button key={c.key} type="button" className="chip" disabled={busy} onClick={() => applyInstruction(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
            <textarea
              className="smart-change-input"
              placeholder="Suggest a change…"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className="secondary smart-change-submit"
              disabled={busy || !customInstruction.trim()}
              onClick={handleCustomSubmit}
            >
              Apply
            </button>

            <button className="primary save-button" disabled={busy} onClick={handleSave}>
              Approve &amp; save
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
