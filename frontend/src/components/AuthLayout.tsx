import type { ReactNode } from 'react';

export default function AuthLayout({ children, visual }: { children: ReactNode; visual?: ReactNode }) {
  return (
    <div className="clay-backdrop">
      <div className="clay-glow clay-glow-a" />
      <div className="clay-glow clay-glow-b" />
      <div className="clay-glow clay-glow-c" />
      <div className="clay-glow clay-glow-d" />
      <div className="clay-glow clay-glow-e" />

      <div className="clay-shell">
        <div className="clay-visual-panel">
          {visual ?? (
            <>
              <img src="/logo.png" alt="Consult" className="clay-visual-logo" />
              <span className="clay-visual-name">Consult Scribe</span>
            </>
          )}
        </div>

        <div className="clay-form-panel">{children}</div>
      </div>

      <footer className="clay-footer">© 2026 Srinivash Karthikeyan. All Rights Reserved.</footer>
    </div>
  );
}
