import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Note, Patient } from '../types';

function ConversationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
      <path d="M21 12a8 8 0 0 1-11.6 7.14L4 20l1.06-4.24A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19v-7" />
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M8 22h8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16M7 12h10M10 19h4" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const AVATAR_PALETTE = [
  { bg: '#fff3d6', ink: '#8a6300' },
  { bg: '#e3edda', ink: '#4a7a2a' },
  { bg: '#ece3f5', ink: '#6b4aa3' },
  { bg: '#fbe1e1', ink: '#b5453f' },
  { bg: '#eee6da', ink: '#7a5a33' },
];

function avatarStyle(seed: string) {
  const sum = seed.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function daysAgoLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

type RowStatus = 'active' | 'review' | 'completed' | 'waiting';

interface Row {
  patient: Patient;
  status: RowStatus;
  consultationId: string | null;
  lastVisitAt: string | null;
  reason: string | null;
}

export default function ScribePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [email, setEmail] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  async function refresh() {
    try {
      const [p, n, a] = await Promise.all([api.listPatients(), api.listNotes(), api.listActiveConsultations()]);
      setPatients(p);
      setNotes(n);
      setActive(a);
    } catch (err) {
      setError((err as Error).message || 'Unable to load consultation data. Please try again.');
    } finally {
      // A temporary API failure must not leave the page on an endless loader.
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAddBusy(true);
    setError('');
    try {
      await api.createPatient({
        name: name.trim(),
        age: age ? Number(age) : null,
        sex: sex || null,
        email: email.trim() || null,
        historyNotes: '',
      });
      setName('');
      setAge('');
      setSex('');
      setEmail('');
      setShowAddForm(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function handleStart(patientId: string) {
    setBusyId(patientId);
    setError('');
    try {
      const consultation = await api.startConsultation(patientId, user?.name || 'Dr. Unknown');
      navigate(`/consultation/${consultation.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleMenu(patientId: string, button: HTMLButtonElement) {
    if (menuId === patientId) {
      setMenuId(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setMenuPosition({ top: Math.min(rect.bottom + 6, window.innerHeight - 112), right: Math.max(12, window.innerWidth - rect.right) });
    setMenuId(patientId);
  }

  const rows: Row[] = patients.map((patient) => {
    const activeConsult = active.find((c) => c.patientId === patient.id);
    const pastConsults = notes.filter((c) => c.patientId === patient.id).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const mostRecentPast = pastConsults[0];
    const current = activeConsult || mostRecentPast;

    let status: RowStatus = 'waiting';
    if (activeConsult) status = 'active';
    else if (mostRecentPast?.status === 'review') status = 'review';
    else if (mostRecentPast?.status === 'approved') status = 'completed';

    return {
      patient,
      status,
      consultationId: current?.id ?? null,
      lastVisitAt: current?.startedAt ?? null,
      reason: current?.finalReport?.chiefComplaint || current?.aiDraft?.chiefComplaint || null,
    };
  });

  const now = Date.now();
  const dateCutoff = dateFilter === 'today' ? now - 86_400_000 : dateFilter === 'week' ? now - 7 * 86_400_000 : dateFilter === 'month' ? now - 30 * 86_400_000 : null;

  const filteredRows = rows
    .filter((r) => !search.trim() || r.patient.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) => {
      if (dateCutoff === null) return true;
      if (!r.lastVisitAt) return false;
      return new Date(r.lastVisitAt).getTime() >= dateCutoff;
    })
    .sort((a, b) => {
      if (sortOrder === 'name') return a.patient.name.localeCompare(b.patient.name);
      const at = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
      const bt = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
      return sortOrder === 'oldest' ? at - bt : bt - at;
    });

  return (
    <div className="scribe-list-page">
      <div className="scribe-list-header">
        <div className="scribe-list-heading">
          <span className="scribe-list-icon">
            <ConversationIcon />
          </span>
          <div>
            <h1>Start a consultation</h1>
            <p>Pick a patient to begin, or check in on where things stand.</p>
          </div>
        </div>
        <button type="button" className="home-cta-primary" onClick={() => setShowAddForm((v) => !v)}>
          <PlusIcon />
          Add patient
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddPatient} className="panel form-row scribe-add-form">
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <input placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
          <select value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">Sex</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
          <input placeholder="Email (for sending reports)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={addBusy} type="submit">
            Save patient
          </button>
        </form>
      )}

      <div className="scribe-toolbar">
        <div className="scribe-toolbar-field scribe-toolbar-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search by patient name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="scribe-toolbar-field">
          <CalendarIcon />
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 days</option>
            <option value="month">Past 30 days</option>
          </select>
          <ChevronDownIcon />
        </div>

        <div className="scribe-toolbar-field">
          <FilterIcon />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All status</option>
            <option value="waiting">Waiting</option>
            <option value="active">In consultation</option>
            <option value="review">Report pending</option>
            <option value="completed">Completed</option>
          </select>
          <ChevronDownIcon />
        </div>

        <div className="scribe-toolbar-field">
          <SortIcon />
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
          <ChevronDownIcon />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loaded && !rows.length && <p className="empty-hint">No patients yet — add one above.</p>}

      {loaded && rows.length > 0 && !filteredRows.length && (
        <p className="empty-hint">No patients match your search/filters.</p>
      )}

      {loaded && filteredRows.length > 0 && (
        <div className="scribe-table-wrap">
          <table className="scribe-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Last visit &amp; reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ patient, status, consultationId, lastVisitAt, reason }) => {
                const colors = avatarStyle(patient.id);
                return (
                  <tr key={patient.id}>
                    <td>
                      <div className="scribe-table-patient">
                        <span className="scribe-row-avatar" style={{ background: colors.bg, color: colors.ink }}>
                          {initials(patient.name)}
                        </span>
                        <div className="scribe-row-identity">
                          <span className="scribe-row-name">{patient.name}</span>
                          <span className="scribe-row-meta">
                            {patient.sex && (
                              <span className={`scribe-sex-icon ${patient.sex}`}>{patient.sex === 'female' ? '♀' : '♂'}</span>
                            )}
                            {patient.age ? `${patient.age} yrs` : ''}
                            {patient.age && patient.sex ? ' · ' : ''}
                            {patient.sex ? patient.sex[0].toUpperCase() + patient.sex.slice(1) : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="scribe-row-visit">
                      {lastVisitAt ? (
                        <>
                          <span className="scribe-row-visit-label">Last visit: {daysAgoLabel(lastVisitAt)}</span>
                          {reason && (
                            <span className="scribe-row-reason">
                              Reason: <span>{reason}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="scribe-row-visit-label">No visits yet</span>
                      )}
                    </td>

                    <td>
                      {status === 'active' && <span className="scribe-status-badge active">● In consultation</span>}
                      {status === 'review' && <span className="scribe-status-badge review">📝 Report pending</span>}
                      {status === 'completed' && <span className="scribe-status-badge completed">✓ Completed</span>}
                      {status === 'waiting' && <span className="scribe-status-badge waiting">⏱ Waiting</span>}
                    </td>

                    <td>
                      <div className="scribe-table-actions">
                        {status === 'active' && (
                          <button
                            type="button"
                            className="scribe-action-btn active"
                            onClick={() => navigate(`/consultation/${consultationId}`)}
                          >
                            Resume <ChevronRightIcon />
                          </button>
                        )}
                        {status === 'review' && (
                          <button
                            type="button"
                            className="scribe-action-btn review"
                            onClick={() => navigate('/notes', { state: { selectId: consultationId } })}
                          >
                            Review report <ChevronRightIcon />
                          </button>
                        )}
                        {status === 'completed' && (
                          <button
                            type="button"
                            className="scribe-action-btn completed"
                            onClick={() => navigate('/notes', { state: { selectId: consultationId } })}
                          >
                            <DocIcon /> View report
                          </button>
                        )}
                        {status === 'waiting' && (
                          <button
                            type="button"
                            className="scribe-action-btn waiting"
                            disabled={busyId === patient.id}
                            onClick={() => handleStart(patient.id)}
                          >
                            <MicIcon /> Start consultation <ChevronRightIcon />
                          </button>
                        )}

                        <div className="scribe-kebab-wrap">
                          <button
                            type="button"
                            className="scribe-kebab-btn"
                            onClick={(event) => toggleMenu(patient.id, event.currentTarget)}
                            aria-label="More actions"
                          >
                            <KebabIcon />
                          </button>
                          {menuId === patient.id && menuPosition && createPortal(
                            <>
                              <div className="scribe-kebab-backdrop" onClick={() => setMenuId(null)} />
                              <div className="scribe-kebab-menu" style={{ top: menuPosition.top, right: menuPosition.right }} role="menu">
                                <button type="button" onClick={() => navigate(`/patient/${patient.id}`)}>
                                  View patient profile
                                </button>
                              </div>
                            </>, document.body
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
