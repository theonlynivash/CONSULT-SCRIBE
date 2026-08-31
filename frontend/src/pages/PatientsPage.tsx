import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Patient } from '../types';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.listPatients().then(setPatients);
  }, []);

  const filtered = patients.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="panel">
      <h2>Patients</h2>
      <p className="hint-text">Every patient on file. Click one to see their visit history.</p>

      <input
        className="scribe-search"
        placeholder="Search patients by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="patient-list">
        {filtered.map((p) => (
          <li key={p.id} className="patient-row">
            <div>
              <button type="button" className="link-button patient-name" onClick={() => navigate(`/patient/${p.id}`)}>
                {p.name}
              </button>
              <span className="patient-meta">
                {p.age ? `${p.age}y` : ''} {p.sex ?? ''}
              </span>
            </div>
          </li>
        ))}
        {!filtered.length && (
          <p className="empty-hint">{patients.length ? 'No patients match that search.' : 'No patients yet — add one from Home.'}</p>
        )}
      </ul>
    </div>
  );
}
