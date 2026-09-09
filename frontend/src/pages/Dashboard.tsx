import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import MiniCalendar from '../components/MiniCalendar';
import type { Note } from '../types';

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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name?: string) {
  return name?.trim().split(' ')[0] || 'Doctor';
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState<Note[]>([]);
  const [status, setStatus] = useState<{ llmConfigured: boolean; sttConfigured: boolean; emailConfigured: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showLetterheadNotice, setShowLetterheadNotice] = useState(() => sessionStorage.getItem('consult-scribe-letterhead-notice-dismissed') !== 'true');

  useEffect(() => {
    Promise.all([api.listNotes(), api.listActiveConsultations(), api.getStatus()]).then(([n, a, s]) => {
      setNotes(n);
      setActive(a);
      setStatus(s);
      setLoaded(true);
    });
  }, []);

  const markedDates = useMemo(() => new Set([...active, ...notes].map((c) => dateKey(c.startedAt))), [active, notes]);
  // Always begin on the real current day. A past consultation is shown only
  // when the doctor deliberately selects its green-marked calendar date.
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  const selectedConsultations = useMemo(() => {
    if (!selectedDate) return notes;
    return notes.filter((n) => dateKey(n.startedAt) === selectedDate);
  }, [notes, selectedDate]);

  const selectedActive = useMemo(() => {
    if (!selectedDate) return active;
    return active.filter((a) => dateKey(a.startedAt) === selectedDate);
  }, [active, selectedDate]);

  const allSelectedDay = useMemo(() => {
    return [...selectedActive, ...selectedConsultations];
  }, [selectedActive, selectedConsultations]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return 'Today';
    const [y, m, d] = selectedDate.split('-').map(Number);
    if (!y || !m || !d) return 'Today';
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString([], { month: 'long', day: 'numeric' });
  }, [selectedDate]);

  const micAvailable = typeof window !== 'undefined' && (
    !!(window.SpeechRecognition || window.webkitSpeechRecognition) ||
    !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  );
  const letterheadComplete = useMemo(() => Boolean(user?.workplaceName?.trim() && user?.workplaceAddress?.trim()), [user?.workplaceName, user?.workplaceAddress]);

  function dismissLetterheadNotice() {
    sessionStorage.setItem('consult-scribe-letterhead-notice-dismissed', 'true');
    setShowLetterheadNotice(false);
  }

  return (
    <div className="home">
      {!letterheadComplete && showLetterheadNotice && (
        <div className="setup-toast" role="status" aria-live="polite">
          <div className="setup-toast-icon" aria-hidden="true">🏥</div>
          <div className="setup-toast-copy">
            <strong>Set up your report letterhead</strong>
            <span>Add your hospital/clinic name and address so every PDF is ready with your professional details.</span>
          </div>
          <div className="setup-toast-actions">
            <button type="button" className="setup-toast-primary" onClick={() => navigate('/settings')}>Set up now</button>
            <button type="button" className="setup-toast-close" onClick={dismissLetterheadNotice} aria-label="Dismiss notification">×</button>
          </div>
        </div>
      )}
      <div className="home-top-row">
        <section className="home-hero">
          <div className="home-hero-text">
            <h1 className="home-greeting">
              {greeting()}, Dr. {firstName(user?.name)} <span aria-hidden="true">👋</span>
            </h1>
            <p className="home-sub">“Listen to your patient, he is telling you the diagnosis.” — Sir William Osler</p>
            <div className="home-hero-actions">
              <button type="button" className="home-cta-primary" onClick={() => navigate('/scribe')}>
                <MicIcon />
                Start consultation
              </button>
              <Link to="/patients" className="home-cta-secondary">
                View patients
              </Link>
            </div>
          </div>
          <img src="/doctor-consult.png" alt="" className="home-illustration" />
        </section>

        <aside className="home-calendar-card">
          <MiniCalendar
            markedDates={markedDates}
            selectedDate={selectedDate}
            onSelectDate={(key) => setSelectedDate(key)}
          />
        </aside>
      </div>

      {loaded && (
        <>
          <section className="home-stats">
            <div className="home-stats-header">
              <h2 className="home-section-label">Consultations • {selectedDateLabel}</h2>
              <span className="home-date-filter-pill">
                {allSelectedDay.length} consultation{allSelectedDay.length === 1 ? '' : 's'} recorded
              </span>
            </div>
            <div className="home-stats-grid">
              <div className="stat-card">
                <span className="stat-value">{allSelectedDay.length}</span>
                <span className="stat-label">Total for day</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{selectedActive.length}</span>
                <span className="stat-label">In progress</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">
                  {selectedConsultations.filter((c) => c.status === 'review').length}
                </span>
                <span className="stat-label">Notes ready</span>
              </div>
            </div>
          </section>

          <section className="home-split">
            <div className="panel home-split-col">
              <h2 className="home-section-label">Active on {selectedDateLabel}</h2>
              {selectedActive[0] ? (
                <div className="home-next">
                  <div>
                    <p className="home-next-name">{selectedActive[0].patientName}</p>
                    <p className="home-next-meta">In progress since {formatTime(selectedActive[0].startedAt)}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/consultation/${selectedActive[0].id}`)}>
                    Continue
                  </button>
                </div>
              ) : (
                <p className="empty-hint">No active consultations in progress for {selectedDateLabel}.</p>
              )}
            </div>

            <div className="panel home-split-col">
              <h2 className="home-section-label">Scribe status</h2>
              <ul className="home-status-list">
                <li>
                  <span className="home-status-dot on" />
                  Clinical scribe ready
                </li>
                <li>
                  <span className={`home-status-dot${micAvailable ? ' on' : ''}`} />
                  {micAvailable ? 'Voice capture available (Chrome SST + Grok mobile fallback)' : 'Voice capture not supported in this browser'}
                </li>
                <li>
                  <span className={`home-status-dot${status?.sttConfigured ? ' on' : ''}`} />
                  {status?.sttConfigured ? 'Grok STT fallback configured' : 'Grok STT fallback not configured'}
                </li>
                <li>
                  <span className={`home-status-dot${status?.emailConfigured ? ' on' : ''}`} />
                  {status?.emailConfigured ? 'Email delivery configured' : 'Email in preview mode'}
                </li>
              </ul>
            </div>
          </section>

          <section className="panel home-recent">
            <div className="home-recent-header">
              <div>
                <h2 className="home-section-label">Reports on {selectedDateLabel}</h2>
                <span className="home-recent-sub">
                  Showing {selectedConsultations.length} report{selectedConsultations.length === 1 ? '' : 's'} on this day
                </span>
              </div>
              <Link to="/notes" className="home-view-all">
                View all notes &rarr;
              </Link>
            </div>
            {selectedConsultations.length ? (
              <ul className="home-recent-list">
                {selectedConsultations.map((n) => (
                  <li
                    key={n.id}
                    className="home-recent-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/consultation/${n.id}`)}
                    title="Click to view consultation report"
                  >
                    <div className="home-recent-col">
                      <span className="home-recent-name">{n.patientName}</span>
                      <span className="home-recent-time">Started at {formatTime(n.startedAt)}</span>
                    </div>
                    <span className="home-recent-date">{new Date(n.startedAt).toLocaleDateString()}</span>
                    <span className={`home-status-badge ${n.status}`}>
                      {n.status === 'approved' ? '✓ Completed' : '📝 Review'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-hint">No completed consultation reports for {selectedDateLabel}.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
