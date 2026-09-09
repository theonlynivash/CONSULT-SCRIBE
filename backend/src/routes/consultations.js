import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { analyzeConsultation, refineDraft } from '../lib/analyze.js';
import { sendReportEmail } from '../lib/mailer.js';
import { transcribeAudio, sttConfigured } from '../lib/stt.js';

export const consultationsRouter = Router();
















function findOwnedConsultation(id, userId) {
  return db.data.consultations.find(
    (c) =>
      c.id === id &&
      c.ownerUserId === userId
  );
}





function findOwnedPatient(patientId, userId) {
  return db.data.patients.find(
    (p) =>
      p.id === patientId &&
      p.ownerUserId === userId
  );
}








function findPreviousVisit(
  patientId,
  excludeId,
  userId
) {
  const others = db.data.consultations
    .filter(
      (c) =>
        c.patientId === patientId &&
        c.ownerUserId === userId &&
        c.id !== excludeId &&
        (c.finalReport || c.aiDraft)
    )
    .sort(
      (a, b) =>
        new Date(b.startedAt) -
        new Date(a.startedAt)
    );

  const prior =
    others.find((c) => c.finalReport) ||
    others[0];

  if (!prior) return null;

  const report =
    prior.finalReport || prior.aiDraft;

  return {
    date: prior.startedAt,
    summary:
      report.querySummary ||
      report.chiefComplaint ||
      'No summary available',
  };
}






consultationsRouter.get('/', async (req, res) => {
  await db.read();

  


  const notes = db.data.consultations
    .filter(
      (c) =>
        c.ownerUserId === req.user.id &&
        c.status !== 'active'
    )
    .map((c) => ({
      ...c,

      patientName:
        db.data.patients.find(
          (p) =>
            p.id === c.patientId &&
            p.ownerUserId === req.user.id
        )?.name ?? 'Unknown patient',
    }))
    .sort(
      (a, b) =>
        new Date(b.startedAt) -
        new Date(a.startedAt)
    );

  res.json(notes);
});






consultationsRouter.get('/active', async (req, res) => {
  await db.read();

  


  const active = db.data.consultations
    .filter(
      (c) =>
        c.ownerUserId === req.user.id &&
        c.status === 'active'
    )
    .map((c) => ({
      ...c,

      patientName:
        db.data.patients.find(
          (p) =>
            p.id === c.patientId &&
            p.ownerUserId === req.user.id
        )?.name ?? 'Unknown patient',
    }))
    .sort(
      (a, b) =>
        new Date(b.startedAt) -
        new Date(a.startedAt)
    );

  res.json(active);
});






consultationsRouter.post('/', async (req, res) => {
  const {
    patientId,
    doctorName,
  } = req.body;

  await db.read();

  








  const patient = findOwnedPatient(
    patientId,
    req.user.id
  );

  if (!patient) {
    return res.status(404).json({
      error: 'patient not found',
    });
  }

  const consultation = {
    id: randomUUID(),

    patientId,

    



    ownerUserId: req.user.id,

    



    doctorName:
      doctorName ||
      req.user.name ||
      'Dr. Unknown',

    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,

    transcript: [],
    vitals: [],
    aiDraft: null,
    finalReport: null,
  };

  db.data.consultations.push(
    consultation
  );

  await db.write();

  res.status(201).json(consultation);
});






consultationsRouter.get('/:id', async (req, res) => {
  await db.read();

  const c =
    findOwnedConsultation(
      req.params.id,
      req.user.id
    );

  




  if (!c) {
    return res.status(404).json({
      error: 'not found',
    });
  }

  res.json(c);
});






consultationsRouter.post(
  '/:id/transcript',
  async (req, res) => {
    const {
      speaker,
      text,
    } = req.body;

    if (!speaker || !text) {
      return res.status(400).json({
        error:
          'speaker and text are required',
      });
    }

    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    c.transcript =
      c.transcript || [];

    c.transcript.push({
      speaker,
      text,
      at: new Date().toISOString(),
    });

    await db.write();

    res.status(201).json(c);
  }
);









consultationsRouter.post(
  '/:id/transcribe',
  express.raw({
    type: ['audio/*', 'application/octet-stream'],
    limit: '50mb',
  }),
  async (req, res) => {
    if (!sttConfigured()) {
      return res.status(503).json({
        error: 'Grok Speech-to-Text is not configured. Add XAI_API_KEY to the backend environment.',
        code: 'STT_NOT_CONFIGURED',
      });
    }

    await db.read();

    const c = findOwnedConsultation(
      req.params.id,
      req.user.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    if (c.status !== 'active') {
      return res.status(400).json({
        error: 'transcription is only available during an active consultation',
      });
    }

    const audioBuffer = Buffer.isBuffer(req.body) ? req.body : null;

    if (!audioBuffer?.length) {
      return res.status(400).json({
        error: 'audio file is required',
      });
    }

    const requestedLanguage = String(req.query?.language || '').trim().toLowerCase();
    const language = requestedLanguage === 'en-in' || requestedLanguage === 'en'
      ? 'en'
      : undefined;

    try {
      const result = await transcribeAudio({
        buffer: audioBuffer,
        mimeType: req.headers['content-type'] || 'audio/webm',
        language,
      });

      res.json(result);
    } catch (err) {
      console.error('Grok Speech-to-Text failed:', err.message);

      const status = err.status === 401 || err.status === 403
        ? 502
        : err.status === 429
          ? 429
          : 502;

      return res.status(status).json({
        error: err.message || 'Grok Speech-to-Text failed.',
        code: err.code || 'STT_PROVIDER_ERROR',
      });
    }
  }
);






consultationsRouter.post(
  '/:id/vitals',
  async (req, res) => {
    const {
      type,
      value,
      unit,
      source,
    } = req.body;

    if (
      !type ||
      value === undefined
    ) {
      return res.status(400).json({
        error:
          'type and value are required',
      });
    }

    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    c.vitals =
      c.vitals || [];

    c.vitals.push({
      type,
      value,
      unit: unit ?? '',
      source:
        source || 'manual',
      at: new Date().toISOString(),
    });

    await db.write();

    res.status(201).json(c);
  }
);






consultationsRouter.post(
  '/:id/end',
  async (req, res) => {
    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    



    const patient =
      findOwnedPatient(
        c.patientId,
        req.user.id
      );

    if (!patient) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    c.endedAt =
      new Date().toISOString();

    c.status = 'review';

    let analysis;

    try {
      analysis =
        await analyzeConsultation(
          c,
          patient
        );
    } catch (err) {
      console.error(
        'Consultation analysis failed:',
        err.message
      );

      return res.status(502).json({
        error:
          err.message ||
          'AI analysis failed. Check GROQ_API_KEY.',
        code:
          'AI_PROVIDER_ERROR',
      });
    }

    





    c.aiDraft = {
      ...analysis,

      previousVisit:
        findPreviousVisit(
          c.patientId,
          c.id,
          req.user.id
        ),
    };

    



    c.finalReport = null;

    await db.write();

    res.json(c);
  }
);






consultationsRouter.post(
  '/:id/approve',
  async (req, res) => {
    const {
      finalReport,
    } = req.body;

    if (!finalReport) {
      return res.status(400).json({
        error:
          'finalReport is required',
      });
    }

    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    



    c.finalReport = {
      ...finalReport,

      approvedAt:
        new Date().toISOString(),
    };

    c.status = 'approved';

    await db.write();

    res.json(c);
  }
);






consultationsRouter.post(
  '/:id/email',
  async (req, res) => {
    const {
      to,
      pdfBase64,
    } = req.body;

    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    


    if (
      c.status !== 'approved' ||
      !c.finalReport
    ) {
      return res.status(400).json({
        error:
          'Only the doctor-approved final report can be sent to the patient.',
      });
    }

    


    const patient =
      findOwnedPatient(
        c.patientId,
        req.user.id
      );

    if (!patient) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    const result =
      await sendReportEmail({
        consultation: c,
        patient,
        to,
        pdfBase64,
      });

    res.json(result);
  }
);






consultationsRouter.post(
  '/:id/regenerate',
  async (req, res) => {
    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    if (c.status !== 'review') {
      return res.status(400).json({
        error:
          'only a note pending review can be regenerated',
      });
    }

    const patient =
      findOwnedPatient(
        c.patientId,
        req.user.id
      );

    if (!patient) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    let analysis;

    try {
      analysis =
        await analyzeConsultation(
          c,
          patient
        );
    } catch (err) {
      console.error(
        'Consultation regeneration failed:',
        err.message
      );

      return res.status(502).json({
        error:
          err.message ||
          'AI analysis failed. Check GROQ_API_KEY.',
        code:
          'AI_PROVIDER_ERROR',
      });
    }

    c.aiDraft = {
      ...analysis,

      previousVisit:
        findPreviousVisit(
          c.patientId,
          c.id,
          req.user.id
        ),
    };

    


    c.finalReport = null;

    await db.write();

    res.json(c);
  }
);











consultationsRouter.post(
  '/:id/refine',
  async (req, res) => {
    const {
      draft,
      instruction,
    } = req.body;

    if (!draft || !instruction) {
      return res.status(400).json({
        error:
          'draft and instruction are required',
      });
    }

    







    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    let revised;

    try {
      revised =
        await refineDraft(
          draft,
          instruction
        );
    } catch (err) {
      console.error(
        'Draft refinement failed:',
        err.message
      );

      return res.status(502).json({
        error:
          err.message ||
          'AI refinement failed. Check GROQ_API_KEY.',
        code:
          'AI_PROVIDER_ERROR',
      });
    }

    



    res.json(revised);
  }
);






consultationsRouter.post(
  '/:id/feedback',
  async (req, res) => {
    const {
      rating,
    } = req.body;

    if (
      rating !== 'up' &&
      rating !== 'down'
    ) {
      return res.status(400).json({
        error:
          'rating must be "up" or "down"',
      });
    }

    await db.read();

    const c =
      findOwnedConsultation(
        req.params.id,
        req.user.id
      );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    c.feedback =
      c.feedback || [];

    c.feedback.push({
      rating,
      at: new Date().toISOString(),
    });

    await db.write();

    res.json({
      ok: true,
    });
  }
);






consultationsRouter.delete(
  '/:id',
  async (req, res) => {
    await db.read();

    






    const idx =
      db.data.consultations.findIndex(
        (c) =>
          c.id === req.params.id &&
          c.ownerUserId === req.user.id
      );

    if (idx === -1) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    db.data.consultations.splice(
      idx,
      1
    );

    await db.write();

    res.status(204).end();
  }
);