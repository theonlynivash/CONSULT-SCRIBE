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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState<Note[]>([]);
  const [status, setStatus] = useState<{ llmConfigured: boolean; emailConfigured: boolean } | null>(null);
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

  const todayCount = [...active, ...notes].filter((c) => isToday(c.startedAt)).length;
  const reviewCount = notes.filter((c) => c.status === 'review').length;
  const nextConsultation = active[0];
  const recent = notes.slice(0, 5);
  const micAvailable = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const markedDates = new Set([...active, ...notes].map((c) => dateKey(c.startedAt)));
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
          <MiniCalendar markedDates={markedDates} />
        </aside>
      </div>

      {loaded && (
        <>
          <section className="home-stats">
            <h2 className="home-section-label">Today</h2>
            <div className="home-stats-grid">
              <div className="stat-card">
                <span className="stat-value">{todayCount}</span>
                <span className="stat-label">Consultations</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{active.length}</span>
                <span className="stat-label">In progress</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{reviewCount}</span>
                <span className="stat-label">Notes ready</span>
              </div>
            </div>
          </section>

          <section className="home-split">
            <div className="panel home-split-col">
              <h2 className="home-section-label">Next consultation</h2>
              {nextConsultation ? (
                <div className="home-next">
                  <div>
                    <p className="home-next-name">{nextConsultation.patientName}</p>
                    <p className="home-next-meta">In progress since {formatTime(nextConsultation.startedAt)}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/consultation/${nextConsultation.id}`)}>
                    Continue
                  </button>
                </div>
              ) : (
                <p className="empty-hint">No consultation in progress right now.</p>
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
                  {micAvailable ? 'Voice capture available' : 'Voice capture not supported in this browser'}
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
              <h2 className="home-section-label">Recent consultations</h2>
              <Link to="/notes" className="home-view-all">
                View all &rarr;
              </Link>
            </div>
            {recent.length ? (
              <ul className="home-recent-list">
                {recent.map((n) => (
                  <li key={n.id} className="home-recent-row">
                    <span className="home-recent-name">{n.patientName}</span>
                    <span className="home-recent-date">{new Date(n.startedAt).toLocaleDateString()}</span>
                    <span className={`home-status-badge ${n.status}`}>
                      {n.status === 'approved' ? '✓ Completed' : '📝 Review'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-hint">No consultations yet — start one above.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
