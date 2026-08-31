import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Patient } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function refresh() {
    setPatients(await api.listPatients());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.createPatient({ name: name.trim(), age: age ? Number(age) : null, sex: sex || null, historyNotes: '' });
      setName('');
      setAge('');
      setSex('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStartConsultation(patientId: string) {
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
    <div className="dashboard">
      <section className="panel">
        <h2>New patient</h2>
        <form onSubmit={handleAddPatient} className="form-row">
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
          <select value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">Sex</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
          <button disabled={busy} type="submit">
            Add patient
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Start a consultation</h2>
        <p className="field-label">Doctor on duty: {user?.name}</p>
        {error && <p className="error-text">{error}</p>}
        <ul className="patient-list">
          {patients.map((p) => (
            <li key={p.id} className="patient-row">
              <div>
                <button type="button" className="link-button patient-name" onClick={() => navigate(`/patient/${p.id}`)}>
                  {p.name}
                </button>
                <span className="patient-meta">
                  {p.age ? `${p.age}y` : ''} {p.sex ?? ''}
                </span>
              </div>
              <button disabled={busy} onClick={() => handleStartConsultation(p.id)}>
                Start consultation
              </button>
            </li>
          ))}
          {!patients.length && <p className="empty-hint">No patients yet — add one above.</p>}
        </ul>
      </section>
    </div>
  );
}
