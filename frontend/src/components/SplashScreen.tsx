import { useEffect, useState } from 'react';

const SPIN_TOTAL_MS = 2500;
const HOLD_MS = 400;
const FADE_AT_MS = SPIN_TOTAL_MS + HOLD_MS;
const FADE_DURATION_MS = 500;
const DONE_AT_MS = FADE_AT_MS + FADE_DURATION_MS;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), FADE_AT_MS);
    const doneTimer = setTimeout(onDone, DONE_AT_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={`splash-screen${fading ? ' splash-exit' : ''}`}>
      <div className="splash-spread" />
      <img src="/logo.png" alt="" className="splash-logo" />
    </div>
  );
}
