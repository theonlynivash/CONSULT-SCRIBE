import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { analyzeConsultation, refineDraft } from '../lib/analyze.js';
import { sendReportEmail } from '../lib/mailer.js';
import { transcribeAudio } from '../lib/transcribe.js';

export const consultationsRouter = Router();

// The single most recent other consultation for this patient.
// Prefer the doctor-approved finalReport when available.
function findPreviousVisit(patientId, excludeId) {
  const others = db.data.consultations
    .filter(
      (c) =>
        c.patientId === patientId &&
        c.id !== excludeId &&
        (c.finalReport || c.aiDraft)
    )
    .sort(
      (a, b) =>
        new Date(b.startedAt) - new Date(a.startedAt)
    );

  const prior =
    others.find((c) => c.finalReport) || others[0];

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

// Notes workspace list
consultationsRouter.get('/', async (req, res) => {
  await db.read();

  const notes = db.data.consultations
    .filter((c) => c.status !== 'active')
    .map((c) => ({
      ...c,
      patientName:
        db.data.patients.find(
          (p) => p.id === c.patientId
        )?.name ?? 'Unknown patient',
    }))
    .sort(
      (a, b) =>
        new Date(b.startedAt) -
        new Date(a.startedAt)
    );

  res.json(notes);
});

// Active consultations
consultationsRouter.get('/active', async (req, res) => {
  await db.read();

  const active = db.data.consultations
    .filter((c) => c.status === 'active')
    .map((c) => ({
      ...c,
      patientName:
        db.data.patients.find(
          (p) => p.id === c.patientId
        )?.name ?? 'Unknown patient',
    }))
    .sort(
      (a, b) =>
        new Date(b.startedAt) -
        new Date(a.startedAt)
    );

  res.json(active);
});

// Start a new consultation
consultationsRouter.post('/', async (req, res) => {
  const { patientId, doctorName } = req.body;

  await db.read();

  const patient = db.data.patients.find(
    (p) => p.id === patientId
  );

  if (!patient) {
    return res.status(404).json({
      error: 'patient not found',
    });
  }

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

// Get one consultation
consultationsRouter.get('/:id', async (req, res) => {
  await db.read();

  const c = db.data.consultations.find(
    (c) => c.id === req.params.id
  );

  if (!c) {
    return res.status(404).json({
      error: 'not found',
    });
  }

  res.json(c);
});

// Audio transcription
consultationsRouter.post(
  '/:id/audio',
  express.raw({
    type: () => true,
    limit: '25mb',
  }),
  async (req, res) => {
    await db.read();

    const c = db.data.consultations.find(
      (row) => row.id === req.params.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    if (
      !Buffer.isBuffer(req.body) ||
      req.body.length === 0
    ) {
      return res.status(400).json({
        error: 'audio body is required',
      });
    }

    const speaker =
      req.query.speaker === 'patient'
        ? 'patient'
        : req.query.speaker === 'doctor'
        ? 'doctor'
        : 'conversation';

    const lang =
      typeof req.query.lang === 'string' &&
      req.query.lang
        ? req.query.lang
        : 'en-IN';

    const localOnly =
      req.query.mode === 'local';

    const mimeType =
      req.headers['content-type'] ||
      'audio/webm';

    try {
      const text = await transcribeAudio(
        req.body,
        mimeType,
        lang,
        { localOnly }
      );

      if (text) {
        c.transcript.push({
          speaker,
          text,
          at: new Date().toISOString(),
        });

        await db.write();
      }

      res.status(201).json(c);
    } catch (err) {
      res.status(502).json({
        error:
          err.message ||
          'transcription failed',
      });
    }
  }
);

// Add transcript manually
consultationsRouter.post(
  '/:id/transcript',
  async (req, res) => {
    const { speaker, text } = req.body;

    if (!speaker || !text) {
      return res.status(400).json({
        error:
          'speaker and text are required',
      });
    }

    await db.read();

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    c.transcript.push({
      speaker,
      text,
      at: new Date().toISOString(),
    });

    await db.write();

    res.status(201).json(c);
  }
);

// Vitals
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

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    c.vitals.push({
      type,
      value,
      unit: unit ?? '',
      source: source || 'manual',
      at: new Date().toISOString(),
    });

    await db.write();

    res.status(201).json(c);
  }
);

// End consultation → generate AI suggestion
consultationsRouter.post(
  '/:id/end',
  async (req, res) => {
    await db.read();

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    const patient =
      db.data.patients.find(
        (p) => p.id === c.patientId
      );

    c.endedAt =
      new Date().toISOString();

    c.status = 'review';

    const analysis =
      await analyzeConsultation(
        c,
        patient
      );

    // IMPORTANT:
    // This is ONLY an AI suggestion.
    // It is NOT the final clinical decision.
    c.aiDraft = {
      ...analysis,
      previousVisit:
        findPreviousVisit(
          c.patientId,
          c.id
        ),
    };

    // Never automatically copy AI draft
    // into finalReport.
    c.finalReport = null;

    await db.write();

    res.json(c);
  }
);

// Doctor approves edited report
consultationsRouter.post(
  '/:id/approve',
  async (req, res) => {
    const { finalReport } =
      req.body;

    if (!finalReport) {
      return res.status(400).json({
        error:
          'finalReport is required',
      });
    }

    await db.read();

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    /*
     * IMPORTANT ARCHITECTURE:
     *
     * aiDraft    = AI suggestion
     * finalReport = doctor's approved decision
     *
     * After this point finalReport is the
     * SINGLE SOURCE OF TRUTH for:
     *
     * - Reports page
     * - PDF
     * - Patient email
     * - Future consultation history
     */

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

// Send the EXACT approved PDF to patient
consultationsRouter.post(
  '/:id/email',
  async (req, res) => {
    const {
      to,
      pdfBase64,
    } = req.body;

    await db.read();

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
    );

    if (!c) {
      return res.status(404).json({
        error: 'not found',
      });
    }

    // NEVER allow an AI-only draft to be emailed.
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
      db.data.patients.find(
        (p) => p.id === c.patientId
      );

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

// Regenerate AI suggestion
consultationsRouter.post(
  '/:id/regenerate',
  async (req, res) => {
    await db.read();

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
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
      db.data.patients.find(
        (p) => p.id === c.patientId
      );

    const analysis =
      await analyzeConsultation(
        c,
        patient
      );

    c.aiDraft = {
      ...analysis,
      previousVisit:
        findPreviousVisit(
          c.patientId,
          c.id
        ),
    };

    // Still only an AI suggestion.
    c.finalReport = null;

    await db.write();

    res.json(c);
  }
);

// Smart Changes
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

    const revised =
      await refineDraft(
        draft,
        instruction
      );

    // Stateless:
    // Nothing is saved until doctor approves.
    res.json(revised);
  }
);

// AI feedback
consultationsRouter.post(
  '/:id/feedback',
  async (req, res) => {
    const { rating } =
      req.body;

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

    const c = db.data.consultations.find(
      (c) => c.id === req.params.id
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

    res.json({ ok: true });
  }
);

// Delete consultation
consultationsRouter.delete(
  '/:id',
  async (req, res) => {
    await db.read();

    const idx =
      db.data.consultations.findIndex(
        (c) => c.id === req.params.id
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