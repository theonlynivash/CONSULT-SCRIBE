import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';
import SocialAuthButtons from '../components/SocialAuthButtons';

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
        <h1>Welcome back</h1>
        <p className="clay-sub">Sign in to continue to your dashboard</p>

        <label className="clay-label">Email</label>
        <input
          className={`clay-input${shake.email ? ' clay-shake' : ''}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder=" "
        />

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
        />

        {noAccount && (
          <p className="clay-error">
            No account with this email. <Link to="/register">Sign up</Link>
          </p>
        )}
        {googleAccount && <p className="clay-error">This account uses Google sign-in — use the button below.</p>}
        {error && <p className="clay-error">{error}</p>}

        <button className="clay-submit" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
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
