import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../theme';

const AVATAR_SIZE = 320;
const WORKPLACE_LOGO_MAX_WIDTH = 900;
const WORKPLACE_LOGO_MAX_HEIGHT = 260;

export const DEFAULT_INCLUDE_VITALS_KEY =
  'consult-scribe-default-include-vitals';

function resizeImageToSquareDataUrl(
  file: File,
  size = AVATAR_SIZE
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(new Error('Could not read that file'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () =>
        reject(new Error('Could not read that image'));

      img.onload = () => {
        const canvas = document.createElement('canvas');

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }

        const scale = Math.max(
          size / img.width,
          size / img.height
        );

        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;

        ctx.drawImage(
          img,
          (size - drawWidth) / 2,
          (size - drawHeight) / 2,
          drawWidth,
          drawHeight
        );

        resolve(
          canvas.toDataURL('image/jpeg', 0.9)
        );
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

function resizeLogoToDataUrl(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(
        new Error('Could not read that logo file')
      );

    reader.onload = () => {
      const img = new Image();

      img.onerror = () =>
        reject(
          new Error('Could not read that logo image')
        );

      img.onload = () => {
        const scale = Math.min(
          1,
          WORKPLACE_LOGO_MAX_WIDTH / img.width,
          WORKPLACE_LOGO_MAX_HEIGHT / img.height
        );

        const canvas =
          document.createElement('canvas');

        canvas.width = Math.max(
          1,
          Math.round(img.width * scale)
        );

        canvas.height = Math.max(
          1,
          Math.round(img.height * scale)
        );

        const ctx =
          canvas.getContext('2d');

        if (!ctx) {
          reject(
            new Error('Canvas not supported')
          );
          return;
        }

        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(
          canvas.toDataURL('image/png')
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const {
    user,
    updateAvatar,
    updateProfile,
  } = useAuth();

  const {
    theme,
    toggleTheme,
  } = useTheme();

  const [status, setStatus] =
    useState<{
      llmConfigured: boolean;
      emailConfigured: boolean;
    } | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const [viewing, setViewing] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [specialty, setSpecialty] =
    useState(
      user?.specialty || ''
    );

  const [specialtySaved, setSpecialtySaved] =
    useState(false);

  const [workplaceType, setWorkplaceType] =
    useState<
      'hospital' | 'clinic'
    >(
      user?.workplaceType ||
        'hospital'
    );

  const [workplaceName, setWorkplaceName] =
    useState(
      user?.workplaceName || ''
    );

  const [workplaceAddress, setWorkplaceAddress] =
    useState(
      user?.workplaceAddress || ''
    );

  const [workplacePhone, setWorkplacePhone] =
    useState(
      user?.workplacePhone || ''
    );

  const [workplaceEmail, setWorkplaceEmail] =
    useState(
      user?.workplaceEmail || ''
    );

  const [workplaceLogo, setWorkplaceLogo] =
    useState<string | null>(
      user?.workplaceLogo || null
    );

  const [workplaceSaved, setWorkplaceSaved] =
    useState(false);

  const [
    workplaceSaveMessage,
    setWorkplaceSaveMessage,
  ] = useState('');

  /*
   * Vitals preference.
   *
   * ON by default unless the doctor
   * has previously turned it OFF.
   */
  const [defaultVitals, setDefaultVitals] =
    useState(
      () =>
        localStorage.getItem(
          DEFAULT_INCLUDE_VITALS_KEY
        ) !== 'false'
    );

  /*
   * System status
   */
  useEffect(() => {
    api
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  /*
   * Restore all saved account information.
   */
  useEffect(() => {
    setSpecialty(
      user?.specialty || ''
    );

    setWorkplaceType(
      user?.workplaceType ||
        'hospital'
    );

    setWorkplaceName(
      user?.workplaceName || ''
    );

    setWorkplaceAddress(
      user?.workplaceAddress || ''
    );

    setWorkplacePhone(
      user?.workplacePhone || ''
    );

    setWorkplaceEmail(
      user?.workplaceEmail || ''
    );

    setWorkplaceLogo(
      user?.workplaceLogo || null
    );
  }, [user]);

  /*
   * Save specialty
   */
  async function handleSaveSpecialty(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setBusy(true);
    setError('');

    try {
      await updateProfile({
        specialty:
          specialty.trim(),
      });

      setSpecialtySaved(true);

      setTimeout(
        () =>
          setSpecialtySaved(false),
        1500
      );
    } catch (err) {
      setError(
        (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * Save hospital / clinic details
   */
  async function handleSaveWorkplace(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setBusy(true);
    setError('');

    try {
      if (
        !workplaceName.trim() ||
        !workplaceAddress.trim()
      ) {
        setError(
          `Please enter your ${workplaceType} name and full address.`
        );

        setBusy(false);
        return;
      }

      await updateProfile({
        workplaceType,
        workplaceName:
          workplaceName.trim(),
        workplaceAddress:
          workplaceAddress.trim(),
        workplacePhone:
          workplacePhone.trim(),
        workplaceEmail:
          workplaceEmail.trim(),
        workplaceLogo,
      });

      setWorkplaceSaved(true);

      setWorkplaceSaveMessage(
        'Saved to your account. These details will remain after restart/login.'
      );

      setTimeout(() => {
        setWorkplaceSaved(false);
        setWorkplaceSaveMessage('');
      }, 3000);
    } catch (err) {
      setError(
        (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * Upload workplace logo
   */
  async function handleWorkplaceLogoChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    e.target.value = '';

    if (!file) return;

    setBusy(true);
    setError('');

    try {
      const logo =
        await resizeLogoToDataUrl(file);

      setWorkplaceLogo(logo);
    } catch (err) {
      setError(
        (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * Toggle default vitals.
   *
   * This is a preference only, so it is
   * stored locally.
   */
  function handleToggleDefaultVitals() {
    const next =
      !defaultVitals;

    setDefaultVitals(next);

    localStorage.setItem(
      DEFAULT_INCLUDE_VITALS_KEY,
      String(next)
    );
  }

  /*
   * Upload profile photo
   */
  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    e.target.value = '';

    if (!file) return;

    setBusy(true);
    setError('');

    try {
      const dataUrl =
        await resizeImageToSquareDataUrl(
          file
        );

      await updateAvatar(
        dataUrl
      );
    } catch (err) {
      setError(
        (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel settings-page">

      {/* =====================================
          ACCOUNT
      ====================================== */}

      <h2>Settings</h2>

      <h3>Account</h3>

      <div className="avatar-editor">

        <button
          type="button"
          className="avatar-preview"
          onClick={() =>
            setViewing(true)
          }
          disabled={!user?.avatar}
          aria-label="View profile photo"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt=""
            />
          ) : (
            <span>
              {initials(
                user?.name
              )}
            </span>
          )}
        </button>

        <button
          type="button"
          className="avatar-edit-btn"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={busy}
          aria-label={
            user?.avatar
              ? 'Change photo'
              : 'Add photo'
          }
        >
          {busy ? '…' : '📷'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={
            handleFileChange
          }
          style={{
            display: 'none',
          }}
        />

      </div>

      <p className="hint-text">
        {user?.avatar
          ? 'Click the photo to view it, or the camera to change it.'
          : 'Add a profile photo.'}
      </p>

      {error && (
        <p className="error-text">
          {error}
        </p>
      )}

      <p className="field-label">
        Name
      </p>

      <p>{user?.name}</p>

      <p className="field-label">
        Email
      </p>

      <p>{user?.email}</p>

      <form
        className="form-row"
        onSubmit={
          handleSaveSpecialty
        }
      >
        <input
          placeholder="Specialty (e.g. General Medicine)"
          value={specialty}
          onChange={(e) =>
            setSpecialty(
              e.target.value
            )
          }
        />

        <button
          disabled={busy}
          type="submit"
        >
          {specialtySaved
            ? 'Saved'
            : 'Save'}
        </button>
      </form>

      {/* =====================================
          REPORT LETTERHEAD
      ====================================== */}

      <div className="settings-section-heading">

        <div>
          <h3>
            Report letterhead
          </h3>

          <p className="hint-text">
            This information appears at
            the top of every consultation
            PDF. Choose where you practise
            and enter the details patients
            should see.
          </p>
        </div>

        <span
          className={
            workplaceName.trim() &&
            workplaceAddress.trim()
              ? 'setup-status complete'
              : 'setup-status'
          }
        >
          {workplaceName.trim() &&
          workplaceAddress.trim()
            ? '✓ Ready for PDFs'
            : 'Setup required'}
        </span>

      </div>

      <form
        className="workplace-form"
        onSubmit={
          handleSaveWorkplace
        }
      >

        {/* =====================================
            HOSPITAL / CLINIC
            NO ICONS
        ====================================== */}

        <div
          className="workplace-type-toggle"
          role="group"
          aria-label="Working location"
        >

          <button
            type="button"
            className={
              workplaceType ===
              'hospital'
                ? 'active'
                : ''
            }
            onClick={() =>
              setWorkplaceType(
                'hospital'
              )
            }
          >
            Hospital
          </button>

          <button
            type="button"
            className={
              workplaceType ===
              'clinic'
                ? 'active'
                : ''
            }
            onClick={() =>
              setWorkplaceType(
                'clinic'
              )
            }
          >
            Clinic
          </button>

        </div>

        {/* =====================================
            WORKPLACE DETAILS
        ====================================== */}

        <div className="workplace-grid">

          <label>
            <span>
              {workplaceType ===
              'hospital'
                ? 'Hospital name'
                : 'Clinic name'}{' '}
              <em>*</em>
            </span>

            <input
              required
              value={
                workplaceName
              }
              onChange={(e) =>
                setWorkplaceName(
                  e.target.value
                )
              }
              placeholder={
                workplaceType ===
                'hospital'
                  ? 'City Care Hospital'
                  : 'Dr. Nisha Clinic'
              }
            />
          </label>

          <label>
            <span>
              Contact phone
            </span>

            <input
              value={
                workplacePhone
              }
              onChange={(e) =>
                setWorkplacePhone(
                  e.target.value
                )
              }
              placeholder="+91 98765 43210"
              inputMode="tel"
            />
          </label>

          <label className="workplace-full">

            <span>
              Full address{' '}
              <em>*</em>
            </span>

            <textarea
              required
              value={
                workplaceAddress
              }
              onChange={(e) =>
                setWorkplaceAddress(
                  e.target.value
                )
              }
              placeholder="Street, area, city, state, PIN code"
              rows={3}
            />

          </label>

          <label>

            <span>
              Contact email
            </span>

            <input
              value={
                workplaceEmail
              }
              onChange={(e) =>
                setWorkplaceEmail(
                  e.target.value
                )
              }
              placeholder="contact@example.com"
              type="email"
            />

          </label>

        </div>

        {/* =====================================
            WORKPLACE LOGO
        ====================================== */}

        <div className="logo-upload-card">

          <div className="workplace-logo-preview">

            {workplaceLogo ? (
              <img
                src={workplaceLogo}
                alt="Workplace logo preview"
              />
            ) : (
              <span>
                LOGO
              </span>
            )}

          </div>

          <div className="logo-upload-copy">

            <strong>
              Workplace logo
            </strong>

            <p>
              Optional. PNG, JPG or
              WebP. It will appear in
              the PDF letterhead.
            </p>

            <div className="logo-upload-actions">

              <label className="secondary upload-label">

                Choose logo

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={
                    handleWorkplaceLogoChange
                  }
                />

              </label>

              {workplaceLogo && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    setWorkplaceLogo(
                      null
                    )
                  }
                >
                  Remove
                </button>
              )}

            </div>

          </div>

        </div>

        {/* =====================================
            SAVE WORKPLACE
        ====================================== */}

        <div className="settings-save-row">

          <button
            className="primary"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Saving…'
              : workplaceSaved
              ? '✓ Details saved'
              : 'Save hospital / clinic details'}
          </button>

          {workplaceSaveMessage && (
            <span
              className="save-success"
              role="status"
            >
              {workplaceSaveMessage}
            </span>
          )}

        </div>

      </form>

      {/* =====================================
          SIMPLE PREFERENCES
      ====================================== */}

      <section className="simple-preferences">

        <h3>Preferences</h3>

        {/* THEME */}

        <div className="simple-setting">

          <span>
            Theme
          </span>

          <button
            type="button"
            className={`simple-toggle ${
              theme === 'dark'
                ? 'on'
                : ''
            }`}
            onClick={
              toggleTheme
            }
            aria-label="Toggle theme"
            aria-pressed={
              theme === 'dark'
            }
          >
            <span />
          </button>

        </div>

        {/* VITALS */}

        <div className="simple-setting">

          <span>
            Vitals
          </span>

          <button
            type="button"
            className={`simple-toggle ${
              defaultVitals
                ? 'on'
                : ''
            }`}
            onClick={
              handleToggleDefaultVitals
            }
            aria-label="Toggle vitals"
            aria-pressed={
              defaultVitals
            }
          >
            <span />
          </button>

        </div>

      </section>

      {/* =====================================
          SYSTEM STATUS
      ====================================== */}

      <h3>
        System status
      </h3>

      <div className="settings-status-list">

        <div className="settings-status-item">

          <span>
            AI analysis
          </span>

          <strong>
            {status
              ? status.llmConfigured
                ? 'LLM-powered'
                : 'Offline heuristic'
              : 'Checking…'}
          </strong>

        </div>

        <div className="settings-status-item">

          <span>
            Email delivery
          </span>

          <strong>
            {status
              ? status.emailConfigured
                ? 'Live SMTP configured'
                : 'Preview mode'
              : 'Checking…'}
          </strong>

        </div>

      </div>

      {/* =====================================
          DATA & PRIVACY
      ====================================== */}

      <h3>
        Data & privacy
      </h3>

      <p className="hint-text">
        Patient data (names, vitals,
        transcripts, generated reports)
        is stored only on this app's own
        server and is never shared with
        third parties beyond the AI/email
        providers configured above, which
        are used solely to generate and
        deliver this patient's own report.
      </p>

      {/* =====================================
          PROFILE LIGHTBOX
      ====================================== */}

      {viewing &&
        user?.avatar && (
          <div
            className="avatar-lightbox"
            onClick={() =>
              setViewing(false)
            }
          >

            <img
              src={user.avatar}
              alt=""
              onClick={(e) =>
                e.stopPropagation()
              }
            />

            <button
              type="button"
              className="avatar-lightbox-close"
              onClick={() =>
                setViewing(false)
              }
              aria-label="Close"
            >
              ×
            </button>

          </div>
        )}

    </div>
  );
}