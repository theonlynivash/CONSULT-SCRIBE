import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Patient } from '../types';

export default function PatientPage() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (patientId) api.getPatient(patientId).then(setPatient);
  }, [patientId]);

  if (!patient) return <p>Loading…</p>;

  const past = (patient.consultations || []).filter((c) => c.status === 'approved');

  return (
    <div className="panel">
      <Link to="/" className="back-link">
        &larr; Back to dashboard
      </Link>
      <h2>{patient.name}</h2>
      <p className="patient-meta">
        {patient.age ? `${patient.age} years` : 'age unknown'} · {patient.sex ?? 'sex unspecified'}
      </p>

      <h3>Visit history</h3>
      {!past.length && <p className="empty-hint">No approved reports yet for this patient.</p>}
      <ul className="history-list">
        {past.map((c) => (
          <li key={c.id} className="history-item">
            <strong>{new Date(c.startedAt).toLocaleDateString()}</strong> — {c.finalReport?.assessment?.slice(0, 140)}
          </li>
        ))}
      </ul>
    </div>
  );
}
