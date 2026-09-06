import type { ReactNode } from 'react';
import { useTheme } from '../theme';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 1 0 20.354 15.354Z" />
    </svg>
  );
}

export default function AuthLayout({ children, visual }: { children: ReactNode; visual?: ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="clay-backdrop">
      <button
        type="button"
        className="clay-theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="clay-glow clay-glow-a" />
      <div className="clay-glow clay-glow-b" />
      <div className="clay-glow clay-glow-c" />
      <div className="clay-glow clay-glow-d" />
      <div className="clay-glow clay-glow-e" />

      <div className="clay-shell">
        <div className="clay-visual-panel">
          {visual ?? (
            <div className="clay-visual-content">
              <div className="clay-logo-ring">
                <div className="clay-logo-circle">
                  <img src="/logo.png" alt="Consult Scribe" className="clay-visual-logo" />
                </div>
              </div>
              <div className="clay-visual-badge">KERNUL TECH PVT LTD</div>
              <h2 className="clay-visual-name">Consult Scribe</h2>
              <p className="clay-visual-desc">Ambient Clinical Intelligence & Documentation</p>
              <div className="clay-live-pill">
                <span className="clay-live-dot" />
                <span className="clay-live-text">Real-time Scribe Online</span>
                <span className="clay-live-waves">
                  <span className="live-wave-bar b1" />
                  <span className="live-wave-bar b2" />
                  <span className="live-wave-bar b3" />
                  <span className="live-wave-bar b4" />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="clay-form-panel">
          <div className="clay-mobile-brand">
            <div className="clay-mobile-logo-wrap">
              <img src="/logo.png" alt="Consult Scribe" className="clay-mobile-logo" />
              <div className="clay-mobile-glow-ring" />
            </div>
            <div className="clay-mobile-meta">
              <span className="clay-mobile-company">KERNUL TECH PVT LTD</span>
              <span className="clay-mobile-app-title">Consult Scribe</span>
            </div>
            <div className="clay-live-pill">
              <span className="clay-live-dot" />
              <span className="clay-live-text">Live Workspace</span>
              <span className="clay-live-waves">
                <span className="live-wave-bar b1" />
                <span className="live-wave-bar b2" />
                <span className="live-wave-bar b3" />
                <span className="live-wave-bar b4" />
              </span>
            </div>
          </div>
          {children}
        </div>
      </div>

      <footer className="clay-footer">© 2026 Srinivash Karthikeyan. All Rights Reserved.</footer>
    </div>
  );
}
