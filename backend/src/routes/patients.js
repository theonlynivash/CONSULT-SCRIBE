import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const patientsRouter = Router();

patientsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.patients);
});

patientsRouter.post('/', async (req, res) => {
  const { name, age, sex, historyNotes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const patient = {
    id: randomUUID(),
    name,
    age: age ?? null,
    sex: sex ?? null,
    historyNotes: historyNotes ?? '',
    createdAt: new Date().toISOString(),
  };

  await db.read();
  db.data.patients.push(patient);
  await db.write();
  res.status(201).json(patient);
});

patientsRouter.get('/:id', async (req, res) => {
  await db.read();
  const patient = db.data.patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: 'not found' });

  const consultations = db.data.consultations
    .filter((c) => c.patientId === patient.id)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  res.json({ ...patient, consultations });
});
