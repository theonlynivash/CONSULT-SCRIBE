import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const patientsRouter = Router();

/*
 * GET ALL PATIENTS
 */
patientsRouter.get('/', async (req, res) => {
  await db.read();

  res.json(db.data.patients);
});

/*
 * CREATE PATIENT
 */
patientsRouter.post('/', async (req, res) => {
  const {
    name,
    age,
    sex,
    email,
    historyNotes,
  } = req.body;

  if (!name) {
    return res.status(400).json({
      error: 'name is required',
    });
  }

  const patient = {
    id: randomUUID(),
    name,
    age: age ?? null,
    sex: sex ?? null,
    email: email || null,
    historyNotes: historyNotes ?? '',
    createdAt: new Date().toISOString(),
  };

  await db.read();

  db.data.patients.push(patient);

  await db.write();

  res.status(201).json(patient);
});

/*
 * GET ONE PATIENT + ALL CONSULTATIONS
 */
patientsRouter.get('/:id', async (req, res) => {
  await db.read();

  const patient = db.data.patients.find(
    (p) => p.id === req.params.id
  );

  if (!patient) {
    return res.status(404).json({
      error: 'not found',
    });
  }

  const consultations = db.data.consultations
    .filter(
      (c) => c.patientId === patient.id
    )
    .sort(
      (a, b) =>
        new Date(b.startedAt) -
        new Date(a.startedAt)
    );

  res.json({
    ...patient,
    consultations,
  });
});

/*
 * DELETE PATIENT
 *
 * IMPORTANT:
 * This permanently deletes:
 *
 * 1. Patient
 * 2. All consultations belonging to patient
 * 3. Their transcripts
 * 4. Their vitals
 * 5. Their AI drafts
 * 6. Their doctor-approved final reports
 *
 * It does NOT affect any other patient.
 */
patientsRouter.delete('/:id', async (req, res) => {
  await db.read();

  const patientIndex =
    db.data.patients.findIndex(
      (p) => p.id === req.params.id
    );

  if (patientIndex === -1) {
    return res.status(404).json({
      error: 'patient not found',
    });
  }

  const patient =
    db.data.patients[patientIndex];

  /*
   * Find all consultations belonging
   * to this patient before deleting them.
   */
  const patientConsultationIds =
    new Set(
      db.data.consultations
        .filter(
          (c) =>
            c.patientId === patient.id
        )
        .map((c) => c.id)
    );

  /*
   * Remove all consultations belonging
   * to this patient.
   */
  const originalConsultationCount =
    db.data.consultations.length;

  db.data.consultations =
    db.data.consultations.filter(
      (c) =>
        c.patientId !== patient.id
    );

  const deletedConsultationCount =
    originalConsultationCount -
    db.data.consultations.length;

  /*
   * Remove the patient.
   */
  db.data.patients.splice(
    patientIndex,
    1
  );

  await db.write();

  res.json({
    success: true,

    message:
      'Patient and all associated consultation records were permanently deleted.',

    deletedPatient: {
      id: patient.id,
      name: patient.name,
    },

    deletedConsultations:
      deletedConsultationCount,

    deletedConsultationIds:
      Array.from(
        patientConsultationIds
      ),
  });
});