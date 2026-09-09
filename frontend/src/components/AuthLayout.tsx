import type { ReactNode } from 'react';
import { useTheme } from '../theme';
import Particles from './Particles';

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.354 15.354A9 9 0 1 1 8.646 3.646 9.003 9.003 0 0 0 20.354 15.354Z" />
    </svg>
  );
}

function BrandMark() {
  return (
    <>
      <div className="clay-logo-ring">
        <div className="clay-logo-circle">
          <img
            src="/logo.png"
            alt="Consult Scribe"
            className="clay-visual-logo"
          />
        </div>
      </div>

      <h2 className="clay-visual-name clay-shine-text">
        <span>CONSULT</span>
        <span>S C R I B E</span>
      </h2>

      <div className="clay-visual-company">KERNUL TECH</div>
    </>
  );
}

export default function AuthLayout({
  children,
  visual,
}: {
  children: ReactNode;
  visual?: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="clay-backdrop">
      {}
      <Particles
        color={theme === 'dark' ? '#ffcf40' : '#c48a08'}
        quantity={theme === 'dark' ? 70 : 52}
      />

      <button
        type="button"
        className="clay-theme-toggle"
        onClick={toggleTheme}
        title={
          theme === 'dark'
            ? 'Switch to light mode'
            : 'Switch to dark mode'
        }
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
              <div className="clay-logo-stage">
                <div className="clay-logo-ring">
                  <div className="clay-logo-circle">
                    <img
                      src="/logo.png"
                      alt="Consult Scribe"
                      className="clay-visual-logo"
                    />
                  </div>
                </div>
              </div>

              <h2 className="clay-visual-name clay-shine-text">
                <span>CONSULT</span>
                <span>S C R I B E</span>
              </h2>

              <div className="clay-visual-company">KERNUL TECH</div>
            </div>
          )}
        </div>

        <div className="clay-form-panel">
          <div className="clay-mobile-brand">
            <BrandMark />
          </div>

          {children}
        </div>
      </div>

      <footer className="clay-footer">
        © 2026 Srinivash Karthikeyan. All Rights Reserved.
      </footer>
    </div>
  );
}