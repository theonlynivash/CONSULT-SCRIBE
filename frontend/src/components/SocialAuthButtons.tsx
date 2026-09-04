import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_LOAD_TIMEOUT_MS = 6000;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
        c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
        c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039
        l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
        c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
        c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-2.02-.888-3.65-.888-1.694 0-2.266.888-3.61.888-1.44 0-2.55-1.4-3.5-2.71C1.9 17.63.75 14.5.75 11.75c0-2.1.94-3.87 2.4-5.02 1.13-.9 2.6-1.44 4-1.44 1.55 0 2.68.9 3.65.9.9 0 2.25-1.1 3.9-1.1.63 0 2.94.06 4.42 2.19-.12.08-2.63 1.53-2.6 4.56.03 3.62 3.16 4.83 3.2 4.85z" />
    </svg>
  );
}

// Google's official rendered button (google.accounts.id.renderButton) lives
// in a cross-origin iframe — no CSS from this app can reach inside it, so it
// can never be pixel-identical to the Apple button next to it. Using the
// custom-button pattern instead (our own <button>, Google's prompt() to
// trigger sign-in) is Google's own documented alternative for exactly this
// case, and it's what lets both buttons share one real CSS class.
export default function SocialAuthButtons({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithGoogle } = useAuth();
  const initializedRef = useRef(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGoogleUnavailable(true);
      return;
    }

    let cancelled = false;

    async function handleCredential(response: { credential: string }) {
      setError('');
      try {
        await loginWithGoogle(response.credential);
        onSuccess();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
      }
    }

    function ensureInitialized() {
      if (cancelled || !window.google || initializedRef.current) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID as string, callback: handleCredential });
      initializedRef.current = true;
    }

    if (window.google) {
      ensureInitialized();
      return;
    }

    // The GIS script (index.html) loads async — it's usually ready before
    // this component mounts, but fall back gracefully (offline, blocked by
    // an extension, etc.) instead of leaving a dead button, matching this
    // app's "never depend on network access" demo philosophy.
    const script = document.getElementById('google-identity-script');
    const onLoad = () => ensureInitialized();
    const onError = () => !cancelled && setGoogleUnavailable(true);
    script?.addEventListener('load', onLoad);
    script?.addEventListener('error', onError);

    const timeout = setTimeout(() => {
      if (!cancelled && !window.google) setGoogleUnavailable(true);
    }, GOOGLE_LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
      clearTimeout(timeout);
    };
  }, [loginWithGoogle, onSuccess]);

  function handleGoogleClick() {
    if (!window.google || !initializedRef.current) return;
    setError('');
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setError('Google sign-in didn’t open — check your browser’s third-party cookie / pop-up settings and try again.');
      }
    });
  }

  return (
    <>
      <div className="clay-divider">
        <span>or continue with</span>
      </div>
      <div className="clay-social-row">
        <button
          type="button"
          className="clay-social-btn"
          onClick={handleGoogleClick}
          disabled={googleUnavailable}
          title={googleUnavailable ? 'Google sign-in is not configured' : undefined}
        >
          <GoogleIcon />
          Sign in
        </button>
        <button type="button" className="clay-social-btn" disabled title="Coming soon">
          <AppleIcon />
          Apple
        </button>
      </div>
      {error && <p className="clay-error">{error}</p>}
    </>
  );
}
