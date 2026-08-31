import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { analyzeConsultation, refineDraft } from '../lib/analyze.js';
import { sendReportEmail } from '../lib/mailer.js';

export const consultationsRouter = Router();

// Notes workspace list — every non-active consultation, newest first, with
// the owning patient's name joined in so the UI doesn't need a second call.
consultationsRouter.get('/', async (req, res) => {
  await db.read();
  const notes = db.data.consultations
    .filter((c) => c.status !== 'active')
    .map((c) => ({ ...c, patientName: db.data.patients.find((p) => p.id === c.patientId)?.name ?? 'Unknown patient' }))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  res.json(notes);
});

consultationsRouter.post('/', async (req, res) => {
  const { patientId, doctorName } = req.body;
  await db.read();
  const patient = db.data.patients.find((p) => p.id === patientId);
  if (!patient) return res.status(404).json({ error: 'patient not found' });

  const consultation = {
    id: randomUUID(),
    patientId,
    doctorName: doctorName || 'Dr. Unknown',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    transcript: [],
    vitals: [],
    aiDraft: null,
    finalReport: null,
  };

  db.data.consultations.push(consultation);
  await db.write();
  res.status(201).json(consultation);
});

consultationsRouter.get('/:id', async (req, res) => {
  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

consultationsRouter.post('/:id/transcript', async (req, res) => {
  const { speaker, text } = req.body;
  if (!speaker || !text) return res.status(400).json({ error: 'speaker and text are required' });

  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });

  c.transcript.push({ speaker, text, at: new Date().toISOString() });
  await db.write();
  res.status(201).json(c);
});

// A real vitals device (ESP32 / Raspberry Pi + sensors) posts here once
// paired to a consultation. Manual entry from the UI uses the same endpoint
// with source: "manual".
consultationsRouter.post('/:id/vitals', async (req, res) => {
  const { type, value, unit, source } = req.body;
  if (!type || value === undefined) return res.status(400).json({ error: 'type and value are required' });

  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });

  c.vitals.push({ type, value, unit: unit ?? '', source: source || 'manual', at: new Date().toISOString() });
  await db.write();
  res.status(201).json(c);
});

consultationsRouter.post('/:id/end', async (req, res) => {
  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  const patient = db.data.patients.find((p) => p.id === c.patientId);

  c.endedAt = new Date().toISOString();
  c.status = 'review';
  c.aiDraft = await analyzeConsultation(c, patient);

  await db.write();
  res.json(c);
});

consultationsRouter.post('/:id/approve', async (req, res) => {
  const { finalReport } = req.body;
  if (!finalReport) return res.status(400).json({ error: 'finalReport is required' });

  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });

  c.finalReport = { ...finalReport, approvedAt: new Date().toISOString() };
  c.status = 'approved';
  await db.write();
  res.json(c);
});

consultationsRouter.post('/:id/email', async (req, res) => {
  const { to } = req.body;
  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  const patient = db.data.patients.find((p) => p.id === c.patientId);

  const result = await sendReportEmail({ consultation: c, patient, to });
  res.json(result);
});

// Re-runs analysis against the current transcript/vitals — the "resume note"
// equivalent for a note that's already been generated but not yet approved.
consultationsRouter.post('/:id/regenerate', async (req, res) => {
  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  if (c.status !== 'review') return res.status(400).json({ error: 'only a note pending review can be regenerated' });
  const patient = db.data.patients.find((p) => p.id === c.patientId);

  c.aiDraft = await analyzeConsultation(c, patient);
  await db.write();
  res.json(c);
});

// Stateless: applies one "Smart Changes" instruction to whatever draft the
// client currently has open (including unsaved edits) and returns the
// revised draft. Nothing is persisted until the doctor approves it.
consultationsRouter.post('/:id/refine', async (req, res) => {
  const { draft, instruction } = req.body;
  if (!draft || !instruction) return res.status(400).json({ error: 'draft and instruction are required' });
  const revised = await refineDraft(draft, instruction);
  res.json(revised);
});

consultationsRouter.post('/:id/feedback', async (req, res) => {
  const { rating } = req.body;
  if (rating !== 'up' && rating !== 'down') return res.status(400).json({ error: 'rating must be "up" or "down"' });

  await db.read();
  const c = db.data.consultations.find((c) => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });

  c.feedback = c.feedback || [];
  c.feedback.push({ rating, at: new Date().toISOString() });
  await db.write();
  res.json({ ok: true });
});

consultationsRouter.delete('/:id', async (req, res) => {
  await db.read();
  const idx = db.data.consultations.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.data.consultations.splice(idx, 1);
  await db.write();
  res.status(204).end();
});
