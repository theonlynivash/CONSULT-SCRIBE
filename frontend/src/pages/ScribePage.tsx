import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Patient } from '../types';

export default function ScribePage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.listPatients().then(setPatients);
  }, []);

  async function handleStart(patientId: string) {
    setBusy(true);
    setError('');
    try {
      const consultation = await api.startConsultation(patientId, user?.name || 'Dr. Unknown');
      navigate(`/consultation/${consultation.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scribe-workspace">
      <aside className="scribe-col-left"></aside>

      <section className="scribe-col-center panel">
        {error && <p className="error-text">{error}</p>}

        <ul className="patient-list">
          {patients.map((p) => (
            <li key={p.id} className="patient-row">
              <div>
                <span className="patient-name">{p.name}</span>
                <span className="patient-meta">
                  {p.age ? `${p.age}y` : ''} {p.sex ?? ''}
                </span>
              </div>
              <button disabled={busy} onClick={() => handleStart(p.id)}>
                Start consultation
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="scribe-col-right"></aside>
    </div>
  );
}
