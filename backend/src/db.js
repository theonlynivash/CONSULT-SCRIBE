import { JSONFilePreset } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'data', 'db.json');

const defaultData = { patients: [], consultations: [], users: [] };

export const db = await JSONFilePreset(file, defaultData);
