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

AI analysis is local-first: the backend calls Ollama at `http://localhost:11434`
using `qwen3:1.7b` (configurable in `backend/.env`). If Ollama/model is unavailable,
the app falls back to its offline heuristic so the consultation can still be completed.

## Structure

- `frontend/` — React + Vite app: dashboard, live consultation capture, AI
  draft review, PDF export, email
- `backend/` — Express API: patients, consultations, transcript, vitals
  ingestion, AI analysis (LLM or offline heuristic), email
- `firmware/` — ESP32 vitals device notes (posts readings to the backend's
  `/vitals` endpoint)

## Speech recognition fallback — whisper.cpp

The consultation is **network-first** for the browser speech recognizer. If pressing **Start conversation** produces the browser's `network` speech-recognition error, Consult Scribe automatically switches to a local whisper.cpp pipeline. It does not keep retrying the online recognizer after the fallback takes over.

The fallback is local to the PC: browser audio is converted to 16-bit/16 kHz WAV and posted only to the local backend, which launches `whisper-cli.exe` against a local GGML model. See `local-whisper/README.md` and run `local-whisper/setup-whisper-windows.ps1` once on Windows.

The multilingual `base` model is used so Tamil and English are both supported. whisper.cpp's CLI expects 16-bit WAV input, which is why the browser creates WAV directly rather than depending on ffmpeg.

## Patient email

The **Send to patient** button sends to the patient's saved email address unless another address is entered. For Gmail SMTP, use a Google App Password in `EMAIL_PASSWORD`; the normal Gmail account password will not authenticate SMTP. After editing `backend/.env`, restart the backend.

If SMTP is not configured, the app deliberately returns a report preview instead of pretending the message was sent.
