import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';
import SocialAuthButtons from '../components/SocialAuthButtons';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="clay-card" onSubmit={handleSubmit}>
        <h1>Create an account</h1>
        <p className="clay-sub">Sign up to start using Consult Scribe</p>

        <label className="clay-label">Full name</label>
        <input
          className="clay-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder=" "
        />

        <label className="clay-label">Email</label>
        <input
          className="clay-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder=" "
        />

        <label className="clay-label">Password</label>
        <PasswordField value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />

        {error && <p className="clay-error">{error}</p>}

        <button className="clay-submit" disabled={busy} type="submit">
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <SocialAuthButtons onSuccess={() => navigate('/', { replace: true })} />

        <div className="clay-footer-row">
          <span>
            Already have an account? <Link to="/login">Sign in</Link>
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}
