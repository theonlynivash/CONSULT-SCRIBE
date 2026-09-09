import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
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

export default function PatientPage() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientId) return;

    setError('');

    api.getPatient(patientId)
      .then(setPatient)
      .catch((err) => {
        setError(
          (err as Error).message || 'Unable to load patient.'
        );
      });
  }, [patientId]);

  async function handleStart() {
    if (!patientId) return;

    setBusy(true);
    setError('');

    try {
      const consultation = await api.startConsultation(
        patientId,
        user?.name || 'Dr. Unknown'
      );

      navigate(`/consultation/${consultation.id}`);
    } catch (err) {
      setError(
        (err as Error).message ||
          'Unable to start consultation.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePatient() {
    if (!patientId) return;

    setDeleteBusy(true);
    setError('');

    try {
      
      
      
      await api.deletePatient(patientId);

      setShowDeleteModal(false);
      navigate('/');
    } catch (err) {
      setDeleteBusy(false);
      setError(
        (err as Error).message ||
          'Unable to delete patient.'
      );
    }
  }

  if (!patient) {
    return (
      <div className="panel">
        {error ? (
          <p className="error-text">{error}</p>
        ) : (
          <p className="empty-hint">Loading…</p>
        )}
      </div>
    );
  }

  const past = (patient.consultations || []).filter(
    (c) => c.status === 'approved'
  );

  const lastVisit = past[0];

  return (
    <>
      <div className="panel">
        <Link to="/" className="back-link">
          &larr; Back to dashboard
        </Link>

        <div className="panel-header-row">
          <div>
            <h2>{patient.name}</h2>

            <p className="patient-meta">
              {patient.age
                ? `${patient.age} years`
                : 'age unknown'}
              {' · '}
              {patient.sex ?? 'sex unspecified'}
              {lastVisit
                ? ` · Last visit ${new Date(
                    lastVisit.startedAt
                  ).toLocaleDateString()}`
                : ''}
            </p>
          </div>

          <div className="patient-page-actions">
            <button
              type="button"
              disabled={busy || deleteBusy}
              onClick={handleStart}
            >
              {busy ? 'Starting…' : 'Start consultation'}
            </button>

            <button
              type="button"
              className="patient-delete-trigger"
              disabled={busy || deleteBusy}
              onClick={() => {
                setError('');
                setShowDeleteModal(true);
              }}
            >
              Delete patient
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <h3>Visit history</h3>

        {!past.length && (
          <p className="empty-hint">
            No approved reports yet for this patient.
          </p>
        )}

        <ul className="history-list">
          {past.map((c) => (
            <li key={c.id} className="history-item">
              <strong>
                {new Date(
                  c.startedAt
                ).toLocaleDateString()}
              </strong>{' '}
              —{' '}
              {c.finalReport?.chiefComplaint ||
                '(no summary)'}
            </li>
          ))}
        </ul>
      </div>

      {showDeleteModal && (
        <div
          className="patient-delete-overlay"
          role="presentation"
        >
          <div
            className="patient-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-patient-title"
            aria-describedby="delete-patient-description"
          >
            <span className="patient-delete-icon" aria-hidden="true">
              <TrashIcon />
            </span>

            <h2 id="delete-patient-title">
              Delete patient?
            </h2>

            <div className="patient-delete-name">
              {patient.name}
            </div>

            <p
              id="delete-patient-description"
              className="patient-delete-description"
            >
              This action permanently deletes this patient
              and all consultation records associated with
              them.
            </p>

            <div className="patient-delete-actions">
              <button
                type="button"
                className="patient-delete-cancel"
                disabled={deleteBusy}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="patient-delete-confirm"
                disabled={deleteBusy}
                onClick={handleDeletePatient}
              >
                {deleteBusy
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