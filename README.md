# Consult Scribe

AI-assisted medical documentation for faster, structured clinical consultations.

Built for **PEC Techathon 4.0 — Healthcare & Social: AI Medical Scribe**.

Consult Scribe helps doctors capture consultations, record patient vitals, generate structured clinical notes, review AI suggestions, and export the approved report.

> **Doctor-in-the-loop:** AI assists with documentation and suggestions. The doctor reviews and approves the final report.

## Features

- Live doctor-patient conversation capture
- English and Tamil speech recognition
- Chrome browser speech recognition
- Live patient vitals
- AI-assisted clinical note generation
- Ranked differential suggestions
- Doctor review and editing
- Patient history and consultation records
- PDF report generation
- Approved report sent to patient by email
- ESP32-based vitals integration

## Technology

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
