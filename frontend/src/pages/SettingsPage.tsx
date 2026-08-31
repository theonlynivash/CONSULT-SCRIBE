import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const AVATAR_SIZE = 320;

function resizeImageToSquareDataUrl(file: File, size = AVATAR_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));

        const scale = Math.max(size / img.width, size / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        ctx.drawImage(img, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export default function SettingsPage() {
  const { user, updateAvatar } = useAuth();
  const [status, setStatus] = useState<{ llmConfigured: boolean; emailConfigured: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await resizeImageToSquareDataUrl(file);
      await updateAvatar(dataUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Settings</h2>

      <h3>Account</h3>

      <div className="avatar-editor">
        <button
          type="button"
          className="avatar-preview"
          onClick={() => setViewing(true)}
          disabled={!user?.avatar}
          aria-label="View profile photo"
        >
          {user?.avatar ? <img src={user.avatar} alt="" /> : <span>{initials(user?.name)}</span>}
        </button>
        <button
          type="button"
          className="avatar-edit-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label={user?.avatar ? 'Change photo' : 'Add photo'}
        >
          {busy ? '…' : '📷'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
      <p className="hint-text">{user?.avatar ? 'Click the photo to view it, or the camera to change it.' : 'Add a profile photo.'}</p>
      {error && <p className="error-text">{error}</p>}

      <p className="field-label">Name</p>
      <p>{user?.name}</p>
      <p className="field-label">Email</p>
      <p>{user?.email}</p>

      <h3>System status</h3>
      <ul className="plain-list">
        <li>
          AI analysis:{' '}
          {status ? (status.llmConfigured ? 'LLM-powered' : 'Offline heuristic (no API key set)') : 'Checking…'}
        </li>
        <li>
          Email delivery:{' '}
          {status ? (status.emailConfigured ? 'Live SMTP configured' : 'Preview mode (no SMTP configured)') : 'Checking…'}
        </li>
      </ul>

      {viewing && user?.avatar && (
        <div className="avatar-lightbox" onClick={() => setViewing(false)}>
          <img src={user.avatar} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="avatar-lightbox-close" onClick={() => setViewing(false)} aria-label="Close">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
