# Consult Scribe

Built for PEC Techathon 4.0 (Healthcare & Social — "AI Medical Scribe"). An
AI-assisted consultation assistant: captures the doctor-patient conversation,
reads live vitals, drafts a structured note + ranked differential for the
doctor to review, and exports/emails the approved report. The doctor
confirms everything — no autonomous diagnosis.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the pitch, architecture, and
what's left before the Sept 3 deadline.

## Run it

```bash
npm run install:all   # first time only
npm run dev
```

Frontend: http://localhost:5173 — Backend: http://localhost:8787

No API keys are required — without `OPENAI_API_KEY`/`GROQ_API_KEY` set (see
`backend/.env.example`), AI analysis runs on a fully offline heuristic
fallback so the demo never depends on network access.

## Structure

- `frontend/` — React + Vite app: dashboard, live consultation capture, AI
  draft review, PDF export, email
- `backend/` — Express API: patients, consultations, transcript, vitals
  ingestion, AI analysis (LLM or offline heuristic), email
- `firmware/` — ESP32 vitals device notes (posts readings to the backend's
  `/vitals` endpoint)
