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

AI analysis and report refinement use the Grok API. Set `GROK_API_KEY` in the backend
environment. Speech recognition uses Chrome's built-in online `SpeechRecognition` API.

## Structure

- `frontend/` — React + Vite app: dashboard, live consultation capture, AI
  draft review, PDF export, email
- `backend/` — Express API: patients, consultations, transcript, vitals
  ingestion, Grok analysis, email
- `firmware/` — ESP32 vitals device notes (posts readings to the backend's
  `/vitals` endpoint)

## Speech recognition

The consultation uses Chrome's built-in online `SpeechRecognition` API. The backend does
not upload or process microphone audio, and whisper.cpp is not included.

## Patient email

The **Send to patient** button sends to the patient's saved email address unless another address is entered. For Gmail SMTP, use a Google App Password in `EMAIL_PASSWORD`; the normal Gmail account password will not authenticate SMTP. After editing `backend/.env`, restart the backend.

If SMTP is not configured, the app deliberately returns a report preview instead of pretending the message was sent.
