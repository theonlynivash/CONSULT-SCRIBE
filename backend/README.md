# Backend (Express)

REST API for Consult Scribe. Storage is a local JSON file (`data/db.json`, git-ignored) via lowdb — good enough for a demo, and the record shapes below map directly onto the relational schema in [../PROJECT_PLAN.md](../PROJECT_PLAN.md) for when this moves to Postgres.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/patients` | list / create patients |
| GET | `/api/patients/:id` | patient + their consultation history |
| POST | `/api/consultations` | start a new consultation `{ patientId, doctorName }` |
| GET | `/api/consultations/:id` | fetch one |
| POST | `/api/consultations/:id/transcript` | append a line `{ speaker, text }` |
| POST | `/api/consultations/:id/vitals` | append a reading `{ type, value, unit, source }` — **this is the endpoint a real device (ESP32/Raspberry Pi) POSTs to** |
| POST | `/api/consultations/:id/end` | close the conversation, runs AI analysis, returns the draft |
| POST | `/api/consultations/:id/approve` | doctor-approved final report `{ finalReport }` |
| POST | `/api/consultations/:id/email` | send (or preview, if SMTP isn't configured) the report |

## AI analysis

`src/lib/analyze.js` calls an OpenAI-compatible LLM if `OPENAI_API_KEY` or `GROQ_API_KEY` is set (see `.env.example`); otherwise it falls back to a fully offline keyword/vitals-threshold heuristic. **The demo works with zero API keys** — this is deliberate so a live demo never depends on network access or a paid key.
