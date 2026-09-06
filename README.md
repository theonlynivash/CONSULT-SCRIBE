<div align="center">

# Consult Scribe

**AI-assisted medical documentation for faster, structured clinical consultations**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](#)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://consult-scribe.vercel.app)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](#)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/theonlynivash/CONSULT-SCRIBE)

**[CLICK TO VISIT THE WEBSAPP](https://consult-scribe-web.vercel.app)**

</div>

---

## What it does

Consult Scribe listens to a doctor–patient consultation, pulls in live vitals, and drafts a **structured clinical note + ranked differential diagnosis** — which the doctor reviews, edits, and approves before it's exported as a **PDF** or **sent to the patient by email**.

> AI drafts it. The doctor approves it. Nothing reaches the patient unreviewed.

```
Add patient → Capture consultation → AI draft
                                          │
Email patient ← Export PDF ← Doctor reviews & approves
```

## Features

| Feature | Details |
|---|---|
| Live capture | Typed transcript or Chrome speech recognition — English + Tamil |
| Vitals | Manual entry or ESP32 device feed (SpO2, pulse, IR temperature) |
| AI draft | Summary, symptoms, action items, follow-up questions |
| Differential diagnosis | Ranked conditions with confidence and rationale |
| Doctor review | Every field editable; nothing finalizes without approval |
| Patient history | Multiple visits per patient |
| Export | One-click A4 PDF |
| Delivery | Approved report emailed to the patient (Gmail SMTP) |
| Auth | Google OAuth + email/password |

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite — dashboard, live capture, review, PDF export, email |
| Backend | Node.js + Express — API, transcript/vitals ingestion, AI drafting, email |
| Firmware | ESP32 — posts vitals to `/api/consultations/:id/vitals` |
| Database | [lowdb](https://github.com/typicode/lowdb) — local JSON store (`backend/data/db.json`, git-ignored) |
| Deployment | Render (API + static frontend) and Vercel (frontend, used for the live demo) |

AI drafting uses an LLM (OpenAI/Groq, or local Ollama `qwen3:1.7b`) when configured — otherwise it falls back to a fully offline keyword + vitals heuristic, so the app works without internet access to any AI service.

<details>
<summary><b>Data model</b></summary>

```
patients        (id, name, age, sex, historyNotes, createdAt)

consultations   (id, patientId, doctorName, status, startedAt, endedAt,
                 transcript, vitals,
                 aiDraft: { summary, symptoms, actionItems,
                            suggestedQuestions, differential },
                 finalReport)
```
`consultations` is the hub — one patient, many visits, each with its own doctor/vitals/report.
</details>

## Quick start

```bash
npm run install:all   # install backend + frontend dependencies
npm run dev            # run both together
```

Windows users can also double-click `START.bat` at the repo root.

<details>
<summary><b>Environment variables</b></summary>

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Verify Google sign-in |
| `JWT_SECRET` | Sign app login sessions |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Enable LLM drafting (else offline heuristic) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `EMAIL_USER` / `EMAIL_PASSWORD` / `EMAIL_FROM` | Gmail SMTP delivery — use a Google App Password, not the account password |

**`frontend/.env`**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

Never commit `.env`, secrets, or `backend/data/db.json` (git-ignored patient data).
</details>

<details>
<summary><b>Deployment config</b></summary>

- `render.yaml` — two services: `consult-scribe-api` (Node, health check `/api/health`) and `consult-scribe-web` (static build of `frontend/`)
- `vercel.json` — frontend deploy, used for the live demo
</details>

<details>
<summary><b>More docs in this repo</b></summary>

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — full architecture and roadmap
- [`CHANGELOG_FINAL.md`](./CHANGELOG_FINAL.md), [`FIXES_2026-09-03.md`](./FIXES_2026-09-03.md) — recent fixes
</details>

---

<div align="center">
Built for <b>PEC Techathon 4.0 — Healthcare &amp; Social: AI Medical Scribe</b>
</div>
