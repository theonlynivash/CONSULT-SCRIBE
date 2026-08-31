import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { patientsRouter } from './src/routes/patients.js';
import { consultationsRouter } from './src/routes/consultations.js';
import { authRouter } from './src/routes/auth.js';
import { requireAuth } from './src/lib/auth.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRouter);
app.use('/api/patients', requireAuth, patientsRouter);
app.use('/api/consultations', requireAuth, consultationsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/status', requireAuth, (req, res) => {
  res.json({
    llmConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY),
    emailConfigured: Boolean(process.env.SMTP_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
  });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
