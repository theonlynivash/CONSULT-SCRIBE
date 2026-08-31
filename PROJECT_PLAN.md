# Consult Scribe — Project Plan

Self-contained roadmap. Follow this even if Claude isn't available.

## Context

Built for **PEC Techathon 4.0** (Cognizant-powered, Panimalar Engineering
College). Problem statement: **Healthcare & Social → "AI Medical Scribe"**
— "Doctors spend a significant amount of time documenting consultations.
Build an AI assistant that converts doctor-patient conversations into
structured medical notes and action items." Our accepted ideation pitch
("AI Clinical Co-Pilot") extends this with vitals-aware questioning and a
ranked differential diagnosis — see
`CTS TECHATHON PROJECT/NON TECHNICALS/IDEA1_CLEARPICTURE.pdf` for the full
pitch.

**Timeline**: MVP + video due ~Sept 3, 2026. Finalist announcement Sept 7.
Grand Finale (live demo to Cognizant leaders) Sept 10–11.

**Jury deliverable** (per `CTS TECHATHON PPT TEMPLATE (1).pptx.pdf`): team
details, problem statement detailing, solution (tech stack + architecture
diagram), **source code on GitHub**, UI screenshots, mentor-connect log.

## What's built (working now)

A full end-to-end loop, verified working (backend API tests + a headless
browser run through the actual UI):

1. **Dashboard** — add a patient, start a consultation.
2. **Live consultation** — transcript capture (typed lines, tagged
   doctor/patient), a **Demo mode** button that plays a scripted
   conversation + vitals for reliable live demos, manual vitals entry.
3. **AI draft** — on "End consultation," the backend generates a structured
   summary, symptoms, action items, suggested follow-up questions, and a
   **ranked differential diagnosis with confidence + rationale**. Uses an
   LLM if `OPENAI_API_KEY`/`GROQ_API_KEY` is set, otherwise a fully offline
   heuristic (keyword + vitals-threshold rules, with negation handling —
   "no chest pain" is not read as a chest pain symptom, and only what the
   *patient* said is scanned for symptoms, not the doctor's questions).
4. **Doctor review** — every field is editable before approval; nothing
   reaches the patient view until approved.
5. **Export** — client-side PDF download, email send with an offline
   preview/simulate fallback if SMTP isn't configured.
6. **Patient history** — a patient's past approved reports, demonstrating
   one-patient-many-visits.
7. **Tamil support** — browser-based Tamil voice capture (Web Speech API,
   `ta-IN`) alongside typed/English input, and the offline heuristic engine
   recognizes common Tamil symptom words (காய்ச்சல், இருமல், மார்பு வலி, etc.)
   with negation handling for Tamil's post-word negation ("...இல்லை").
   **The report is always in English** regardless of input language, since
   the heuristic's internal categories are English labels and the LLM path
   is explicitly instructed to respond in English. Caveat worth stating
   honestly to the jury: the offline heuristic is dictionary-based and will
   miss inflected Tamil word forms (Tamil is agglutinative — suffixes fuse
   onto stems) — real robustness on natural Tamil speech needs the LLM path
   (an API key), which understands Tamil morphology natively.

Run it: `npm run install:all && npm run dev` (see root README).

## Data model

```
patients        (id, name, age, sex, historyNotes, createdAt)
consultations   (id, patientId, doctorName, status, startedAt, endedAt,
                 transcript: [{speaker, text, at}],
                 vitals: [{type, value, unit, source, at}],
                 aiDraft: {summary, symptoms, actionItems, suggestedQuestions,
                           differential: [{condition, confidence, rationale}]},
                 finalReport: same shape as aiDraft, once approved)
```

Stored in a local JSON file (`backend/data/db.json`, git-ignored) via
lowdb — fine for a demo; the shapes above map directly onto normalized
Postgres tables (`consultations` as the hub, `conditions`/`tests` as
lookup tables via junction tables) for when this becomes a real
multi-tenant SaaS. `consultations` — not `patients` — is the hub, because
one patient has many visits and each visit has its own doctor, vitals,
and report.

## What's left before Sept 3

- [ ] **Wire in real hardware.** ESP32 + MAX30102 (SpO2/pulse) + MLX90614
      (IR temp) → POST readings to `/api/consultations/:id/vitals` (see
      `firmware/README.md`). Manual entry already works as a fallback if
      hardware isn't ready in time for the video.
- [ ] **Push to GitHub** — the PPT template requires a source link.
- [ ] **Fill the PPT deck** using `CTS TECHATHON PPT TEMPLATE (1).pptx.pdf`
      — problem statement detailing, solution/architecture (the diagrams
      built earlier in this session cover this), screenshots, source link.
- [ ] **Record the demo video** — Dashboard → add patient → start
      consultation → Demo mode (or live mic/hardware) → end consultation →
      review AI draft → approve → PDF/email.
- [ ] **Mentor connect log** — fill in actual meeting dates/agenda per the
      template.
- [ ] Optional, if time allows: browser mic capture (Web Speech API) as an
      alternative to typing transcript lines live.

## Hosting at scale (for the "Solution" slide's business case)

One backend + one database serves every hospital; each row is scoped by a
`hospital_id`. Devices authenticate with a per-device token issued once
during setup, then attach to whichever consultation the doctor selects on
screen for that visit — the device itself never needs to know which
hospital or doctor it belongs to beyond that. This is the standard
multi-tenant SaaS pattern, not something built for this MVP but worth
stating in the pitch as the scaling story.

## If you get stuck without Claude

- Express docs: expressjs.com
- Vite + React: vite.dev
- lowdb: github.com/typicode/lowdb
- MAX30102 Arduino library: SparkFun's MAX3010x library
- MLX90614 Arduino library: Adafruit's MLX90614 library
- Keep commits small — commit after each working milestone above.
