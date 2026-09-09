# Frontend (React + Vite)

- `pages/Dashboard.tsx` — add a patient, start a consultation
- `pages/ConsultationPage.tsx` — live transcript + vitals capture, **Demo mode** (scripted conversation for reliable live demos), AI draft review, approve, PDF export, email
- `pages/PatientPage.tsx` — a patient's approved visit history

Dev server proxies `/api` to the backend on port 8787 (see `vite.config.ts`).
