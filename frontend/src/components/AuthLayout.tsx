import type { ReactNode } from 'react';
import { useTheme } from '../theme';
import Meteors from './Meteors';
import OrbitingCircles from './OrbitingCircles';
import Particles from './Particles';
import Ripple from './Ripple';

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

function BrandMark() {
  return (
    <>
      <div className="clay-logo-ring">
        <div className="clay-logo-circle">
          <img src="/logo.png" alt="Consult Scribe" className="clay-visual-logo" />
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

function AmbientEffects() {
  return (
    <div className="clay-ambient-effects" aria-hidden="true">
      <span className="clay-light-ray clay-light-ray-a" />
      <span className="clay-light-ray clay-light-ray-b" />
      <span className="clay-light-ray clay-light-ray-c" />
      <span className="clay-grid-pulse clay-grid-pulse-a" />
      <span className="clay-grid-pulse clay-grid-pulse-b" />
      <span className="clay-grid-pulse clay-grid-pulse-c" />
    </div>
  );
}

function ForegroundSparks() {
  return (
    <div className="clay-foreground-sparks" aria-hidden="true">
      <span className="clay-comet clay-comet-a" />
      <span className="clay-comet clay-comet-b" />
      <span className="clay-comet clay-comet-c" />
      <span className="clay-comet clay-comet-d" />
      <span className="clay-spark clay-spark-a" />
      <span className="clay-spark clay-spark-b" />
      <span className="clay-spark clay-spark-c" />
      <span className="clay-spark clay-spark-d" />
    </div>
  );
}

export default function AuthLayout({ children, visual }: { children: ReactNode; visual?: ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="clay-backdrop">
      <Particles color={theme === 'dark' ? '#ffcf40' : '#c48a08'} quantity={theme === 'dark' ? 70 : 52} />
      <AmbientEffects />
      <ForegroundSparks />

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
        <span className="clay-border-beam" aria-hidden="true" />
        <div className="clay-visual-panel">
          {visual ?? (
            <div className="clay-visual-content">
              <Ripple />
              <Meteors />
              <div className="clay-logo-stage">
                <OrbitingCircles />
                <div className="clay-logo-ring">
                  <div className="clay-logo-circle">
                    <img src="/logo.png" alt="Consult Scribe" className="clay-visual-logo" />
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

      <footer className="clay-footer">© 2026 Srinivash Karthikeyan. All Rights Reserved.</footer>
    </div>
  );
}
