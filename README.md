# Consult Scribe

AI-assisted medical documentation for faster, structured clinical consultations.

Built for **PEC Techathon 4.0 — Healthcare & Social: AI Medical Scribe**.

Consult Scribe helps doctors capture consultations, record patient vitals, generate structured clinical notes, review AI suggestions, and export the approved report.

> **Doctor-in-the-loop:** AI assists with documentation and suggestions. The doctor reviews and approves the final report.

## Features

- Live doctor-patient conversation capture
- English and Tamil speech recognition
- Local speech transcription with whisper.cpp fallback
- Live patient vitals
- AI-assisted clinical note generation
- Ranked differential suggestions
- Doctor review and editing
- Patient history and consultation records
- PDF report generation
- Approved report sent to patient by email
- ESP32-based vitals integration

## Technology

| Component | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| AI | Ollama + Qwen3 |
| Speech | Browser Speech API + whisper.cpp |
| Database | LowDB |
| Reports | jsPDF |
| Hardware | ESP32 + MAX30102 + MLX90614 |
| Email | Gmail SMTP |

## Architecture

```text
Doctor
   │
   ▼
Consult Scribe
   │
   ├── Conversation
   │      ├── Browser Speech Recognition
   │      └── whisper.cpp fallback
   │
   ├── Patient Vitals
   │      └── ESP32
   │
   ▼
Backend
   │
   ├── Ollama + Qwen3
   ├── Patient Records
   └── Consultation Data
   │
   ▼
Doctor Review
   │
   ▼
Approved Report
   ├── PDF
   └── Patient Email
