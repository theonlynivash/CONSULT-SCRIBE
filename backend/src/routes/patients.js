import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const patientsRouter = Router();






















patientsRouter.get('/', async (req, res) => {
  await db.read();

  const patients = db.data.patients.filter(
    (patient) =>
      patient.ownerUserId === req.user.id
  );

  res.json(patients);
});








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






patientsRouter.get('/:id', async (req, res) => {
  await db.read();

  const patient = db.data.patients.find(
    (p) =>
      p.id === req.params.id &&
      p.ownerUserId === req.user.id
  );

  







  if (!patient) {
    return res.status(404).json({
      error: 'not found',
    });
  }

  







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