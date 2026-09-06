import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';
import SocialAuthButtons from '../components/SocialAuthButtons';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [noAccount, setNoAccount] = useState(false);
  const [googleAccount, setGoogleAccount] = useState(false);
  const [shake, setShake] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  function triggerShake(fields: { email?: boolean; password?: boolean }) {
    setShake({ email: !!fields.email, password: !!fields.password });
    setTimeout(() => setShake({ email: false, password: false }), 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNoAccount(false);
    setGoogleAccount(false);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'no_account') {
        setNoAccount(true);
        triggerShake({ email: true });
      } else if (code === 'google_account') {
        setGoogleAccount(true);
        triggerShake({ email: true });
      } else {
        setError('Invalid credentials');
        triggerShake({ email: true, password: true });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="clay-card" onSubmit={handleSubmit}>
        <h1 className="clay-login-header">LOGIN</h1>

        <label className="clay-label">Email</label>
        <div className={`clay-input-wrap${shake.email ? ' clay-shake' : ''}`}>
          <span className="clay-input-left-icon">
            <MailIcon />
          </span>
          <input
            className="clay-input has-left-icon"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="Enter your email"
          />
        </div>

        <div className="clay-label-row">
          <label className="clay-label">Password</label>
          <Link to="/forgot-password" className="clay-forgot-link">
            Forgot password?
          </Link>
        </div>
        <PasswordField
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
          shake={shake.password}
          placeholder="Enter your password"
        />

        {noAccount && (
          <p className="clay-error">
            No account with this email. <Link to="/register">Sign up</Link>
          </p>
        )}
        {googleAccount && <p className="clay-error">This account uses Google sign-in — use the button below.</p>}
        {error && <p className="clay-error">{error}</p>}

        <button className="clay-submit clay-shimmer-btn" disabled={busy} type="submit">
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
          {!busy && <ArrowRightIcon />}
        </button>

        <SocialAuthButtons onSuccess={() => navigate(from, { replace: true })} />

        <div className="clay-footer-row">
          <span>
            No account yet? <Link to="/register">Sign up</Link>
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}
