import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const patientsRouter = Router();

/*
 * SECURITY MODEL
 *
 * Every patient belongs to exactly one authenticated doctor.
 *
 * ownerUserId is NEVER accepted from req.body.
 * It is ALWAYS taken from req.user.id.
 *
 * req.user.id comes from the verified JWT.
 */

/*
 * GET ALL PATIENTS
 *
 * IMPORTANT:
 * Only return patients owned by the currently
 * authenticated doctor.
 *
 * Legacy patients without ownerUserId are intentionally
 * NOT returned.
 */
patientsRouter.get('/', async (req, res) => {
  await db.read();

  const patients = db.data.patients.filter(
    (patient) =>
      patient.ownerUserId === req.user.id
  );

  res.json(patients);
});

/*
 * CREATE PATIENT
 *
 * The owner is ALWAYS the authenticated doctor.
 *
 * Never trust ownerUserId from the frontend.
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

    // SECURITY:
    // ownership comes from the authenticated JWT,
    // NOT from the request body.
    ownerUserId: req.user.id,

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
 *
 * A doctor can only access their own patient.
 */
patientsRouter.get('/:id', async (req, res) => {
  await db.read();

  const patient = db.data.patients.find(
    (p) =>
      p.id === req.params.id &&
      p.ownerUserId === req.user.id
  );

  /*
   * IMPORTANT:
   * Return the same 404 whether the patient doesn't exist
   * or belongs to another doctor.
   *
   * This avoids revealing whether another doctor's
   * patient ID exists.
   */
  if (!patient) {
    return res.status(404).json({
      error: 'not found',
    });
  }

  /*
   * Only return consultations belonging to:
   *
   * 1. this patient
   * 2. this authenticated doctor
   *
   * The second check is defense-in-depth.
   */
  const consultations = db.data.consultations
    .filter(
      (c) =>
        c.patientId === patient.id &&
        c.ownerUserId === req.user.id
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
 * This can ONLY delete a patient belonging
 * to the authenticated doctor.
 *
 * It also deletes that patient's consultations,
 * but ONLY consultations owned by the same doctor.
 */
patientsRouter.delete('/:id', async (req, res) => {
  await db.read();

  const patientIndex =
    db.data.patients.findIndex(
      (p) =>
        p.id === req.params.id &&
        p.ownerUserId === req.user.id
    );

  if (patientIndex === -1) {
    return res.status(404).json({
      error: 'patient not found',
    });
  }

  const patient =
    db.data.patients[patientIndex];

  /*
   * Find consultations belonging to:
   *
   * - this patient
   * - this authenticated doctor
   */
  const patientConsultationIds =
    new Set(
      db.data.consultations
        .filter(
          (c) =>
            c.patientId === patient.id &&
            c.ownerUserId === req.user.id
        )
        .map((c) => c.id)
    );

  /*
   * Remove ONLY this doctor's consultations
   * for this patient.
   */
  const originalConsultationCount =
    db.data.consultations.length;

  db.data.consultations =
    db.data.consultations.filter(
      (c) =>
        !(
          c.patientId === patient.id &&
          c.ownerUserId === req.user.id
        )
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
      Array.from(patientConsultationIds),
  });
});