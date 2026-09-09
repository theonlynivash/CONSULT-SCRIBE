import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';

type Step = 'email' | 'reset';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const navigate = useNavigate();

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.forgotPassword(email.trim());
      setInfo('If that email has an account, a 6-digit code has been sent to it.');
      setStep('reset');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.resetPassword({ email: email.trim(), otp: otp.trim(), newPassword });
      navigate('/login', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError('');
    try {
      await api.forgotPassword(email.trim());
      setInfo('A new code has been sent.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      visual={
        step === 'email' ? (
          <img src="/forgot-password-illustration.png" alt="Forgot password" className="clay-visual-illustration" />
        ) : (
          <img src="/reset-password-illustration.png" alt="Reset password" className="clay-visual-illustration" />
        )
      }
    >
      {step === 'email' ? (
        <form className="clay-card" onSubmit={handleRequestOtp}>
          <h1>Forgot password</h1>
          <p className="clay-sub">Enter your email and we'll send a 6-digit reset code</p>

          <label className="clay-label">Email</label>
          <input
            className="clay-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder=" "
          />

          {error && <p className="clay-error">{error}</p>}

          <button className="clay-submit" disabled={busy} type="submit">
            {busy ? 'Sending code…' : 'Send code'}
          </button>

          <div className="clay-footer-row">
            <span>
              Remembered it? <Link to="/login">Sign in</Link>
            </span>
          </div>
        </form>
      ) : (
        <form className="clay-card" onSubmit={handleResetPassword}>
          <h1>Enter reset code</h1>
          <p className="clay-sub">{info || `Enter the 6-digit code sent to ${email}`}</p>

          <label className="clay-label">6-digit code</label>
          <input
            className="clay-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoFocus
            inputMode="numeric"
            maxLength={6}
            placeholder=" "
          />

          <label className="clay-label">New password</label>
          <PasswordField value={newPassword} onChange={setNewPassword} required minLength={8} autoComplete="new-password" />

          {error && <p className="clay-error">{error}</p>}

          <button className="clay-submit" disabled={busy} type="submit">
            {busy ? 'Resetting…' : 'Reset password'}
          </button>

          <div className="clay-footer-row">
            <span>
              Didn't get a code?{' '}
              <button type="button" className="link-button" onClick={handleResend} disabled={busy}>
                Resend
              </button>
            </span>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
