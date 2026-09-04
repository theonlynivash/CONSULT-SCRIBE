import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Patient } from '../types';

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [email, setEmail] = useState('');

  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);

  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const navigate = useNavigate();

  async function refresh() {
    const data = await api.listPatients();
    setPatients(data);
  }

  useEffect(() => {
    refresh().catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load patients.'
      );
    });
  }, []);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return;

    setBusy(true);
    setError('');

    try {
      await api.createPatient({
        name: name.trim(),
        age: age ? Number(age) : null,
        sex: sex || null,
        email: email.trim() || null,
        historyNotes: '',
      });

      setName('');
      setAge('');
      setSex('');
      setEmail('');

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add patient.'
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * First step:
   * Open the confirmation dialog.
   *
   * Nothing is deleted here.
   */
  function requestDeletePatient(patient: Patient) {
    setDeleteError('');
    setDeletePatient(patient);
  }

  /*
   * Second step:
   * Actually permanently delete the patient.
   */
  async function confirmDeletePatient() {
    if (!deletePatient) return;

    const patient = deletePatient;

    setDeletingId(patient.id);
    setDeleteError('');

    try {
      await api.deletePatient(patient.id);

      /*
       * Close confirmation dialog.
       */
      setDeletePatient(null);

      /*
       * Refresh the list immediately.
       */
      await refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Unable to delete patient.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  function cancelDeletePatient() {
    if (deletingId) return;

    setDeletePatient(null);
    setDeleteError('');
  }

  const filtered = patients.filter((p) =>
    p.name
      .toLowerCase()
      .includes(
        query.trim().toLowerCase()
      )
  );

  return (
    <>
      {/* ================================
          NEW PATIENT
      ================================= */}

      <section className="panel">
        <h2>New patient</h2>

        <form
          onSubmit={handleAddPatient}
          className="form-row"
        >
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            required
          />

          <input
            placeholder="Age"
            value={age}
            onChange={(e) =>
              setAge(e.target.value)
            }
            inputMode="numeric"
          />

          <select
            value={sex}
            onChange={(e) =>
              setSex(e.target.value)
            }
          >
            <option value="">Sex</option>
            <option value="female">
              Female
            </option>
            <option value="male">
              Male
            </option>
            <option value="other">
              Other
            </option>
          </select>

          <input
            placeholder="Email (for sending reports)"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <button
            disabled={busy}
            type="submit"
          >
            {busy
              ? 'Adding…'
              : 'Add patient'}
          </button>
        </form>

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}
      </section>

      {/* ================================
          PATIENT LIST
      ================================= */}

      <div className="panel">
        <h2>Patients</h2>

        <p className="hint-text">
          Every patient on file. Click one
          to see their visit history.
        </p>

        <input
          className="scribe-search"
          placeholder="Search patients by name…"
          value={query}
          onChange={(e) =>
            setQuery(e.target.value)
          }
        />

        <ul className="patient-list">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="patient-row"
            >
              <div className="patient-row-main">
                <button
                  type="button"
                  className="link-button patient-name"
                  onClick={() =>
                    navigate(
                      `/patient/${p.id}`
                    )
                  }
                >
                  {p.name}
                </button>

                <span className="patient-meta">
                  {p.age
                    ? `${p.age}y`
                    : ''}{' '}
                  {p.sex ?? ''}
                </span>
              </div>

              {/* DELETE BUTTON */}
              <button
                type="button"
                className="patient-delete-button"
                onClick={() =>
                  requestDeletePatient(p)
                }
                disabled={
                  deletingId === p.id
                }
                title="Delete patient permanently"
              >
                {deletingId === p.id
                  ? 'Deleting…'
                  : 'Delete'}
              </button>
            </li>
          ))}

          {!filtered.length && (
            <p className="empty-hint">
              {patients.length
                ? 'No patients match that search.'
                : 'No patients yet — add one above.'}
            </p>
          )}
        </ul>
      </div>

      {/* ================================
          DELETE CONFIRMATION MODAL
      ================================= */}

      {deletePatient && (
        <div
          className="patient-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-patient-title"
        >
          <div className="patient-delete-modal">
            <div className="patient-delete-icon" aria-hidden="true">
              <TrashIcon />
            </div>

            <h3 id="delete-patient-title">
              Delete patient?
            </h3>

            <p className="patient-delete-name">
              {deletePatient.name}
            </p>

            <p className="patient-delete-warning">
              This action permanently deletes
              this patient and all consultation
              records associated with them.
            </p>

            <p className="patient-delete-warning strong">
              This cannot be undone.
            </p>

            {deleteError && (
              <p className="error-text">
                {deleteError}
              </p>
            )}

            <div className="patient-delete-actions">
              <button
                type="button"
                className="patient-delete-cancel"
                onClick={
                  cancelDeletePatient
                }
                disabled={Boolean(
                  deletingId
                )}
              >
                Cancel
              </button>

              <button
                type="button"
                className="patient-delete-confirm"
                onClick={
                  confirmDeletePatient
                }
                disabled={Boolean(
                  deletingId
                )}
              >
                {deletingId
                  ? 'Deleting…'
                  : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}