import type { ReactNode } from 'react';

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h8a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 2l1.4 6.2L19 9.5l-5.6 1.3L12 17l-1.4-6.2L5 9.5l5.6-1.3L12 2Z" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5-5 3 10 2.5-5H21" />
    </svg>
  );
}

const ICONS: ReactNode[] = [<MicIcon key="mic" />, <NoteIcon key="note" />, <SparkIcon key="spark" />, <PulseIcon key="pulse" />];

export default function OrbitingCircles({ radius = 118, duration = 22 }: { radius?: number; duration?: number }) {
  return (
    <div className="clay-orbit" style={{ width: radius * 2, height: radius * 2 }} aria-hidden="true">
      <span className="clay-orbit-path" />
      {ICONS.map((icon, index) => (
        <span
          key={index}
          className="clay-orbit-item"
          style={{
            animationDuration: `${duration}s`,
            animationDelay: `${-(duration / ICONS.length) * index}s`,
          }}
        >
          <span className="clay-orbit-icon">{icon}</span>
        </span>
      ))}
    </div>
  );
}
