import { JSONFilePreset } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Vercel only permits writes in /tmp. This keeps the demo usable there, but
// data is temporary; use a hosted database for durable production records.
const file = process.env.VERCEL
	? path.join('/tmp', 'consult-scribe-db.json')
	: path.join(__dirname, '..', 'data', 'db.json');

const defaultData = { patients: [], consultations: [], users: [] };

export const db = await JSONFilePreset(file, defaultData);
