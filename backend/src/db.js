import { JSONFilePreset } from 'lowdb/node';
import { neon } from '@neondatabase/serverless';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const file = process.env.VERCEL
	? path.join('/tmp', 'consult-scribe-db.json')
	: path.join(__dirname, '..', 'data', 'db.json');

const defaultData = { patients: [], consultations: [], users: [] };

const databaseUrl = String(process.env.DATABASE_URL || '').trim();

async function createSchema(sql) {
	await sql`CREATE TABLE IF NOT EXISTS users (
		id text PRIMARY KEY,
		name text NOT NULL,
		email text UNIQUE NOT NULL,
		password_hash text,
		google_id text,
		avatar text,
		specialty text,
		workplace_type text,
		workplace_name text,
		workplace_address text,
		workplace_phone text,
		workplace_email text,
		workplace_logo text,
		reset_otp_hash text,
		reset_otp_expires_at timestamptz,
		created_at timestamptz NOT NULL
	)`;
	await sql`CREATE TABLE IF NOT EXISTS patients (
		id text PRIMARY KEY,
		name text NOT NULL,
		age integer,
		sex text,
		email text,
		history_notes text NOT NULL DEFAULT '',
		owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL
	)`;
	
	
	await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS owner_user_id text REFERENCES users(id) ON DELETE SET NULL`;
	await sql`CREATE TABLE IF NOT EXISTS consultations (
		id text PRIMARY KEY,
		patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
		owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
		doctor_name text NOT NULL,
		status text NOT NULL,
		started_at timestamptz NOT NULL,
		ended_at timestamptz,
		transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
		vitals jsonb NOT NULL DEFAULT '[]'::jsonb,
		ai_draft jsonb,
		final_report jsonb,
		feedback jsonb NOT NULL DEFAULT '[]'::jsonb
	)`;
	await sql`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS owner_user_id text REFERENCES users(id) ON DELETE SET NULL`;
}

function asIso(value) {
	return value ? new Date(value).toISOString() : null;
}

async function createNeonDb() {
	const sql = neon(databaseUrl);
	await createSchema(sql);
	const data = { ...defaultData };
	return {
		data,
		async read() {
			const [users, patients, consultations] = await Promise.all([
				sql`SELECT * FROM users ORDER BY created_at`,
				sql`SELECT * FROM patients ORDER BY created_at`,
				sql`SELECT * FROM consultations ORDER BY started_at`,
			]);
			data.users = users.map((row) => ({
				id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash,
				googleId: row.google_id, avatar: row.avatar, specialty: row.specialty,
				workplaceType: row.workplace_type, workplaceName: row.workplace_name,
				workplaceAddress: row.workplace_address, workplacePhone: row.workplace_phone,
				workplaceEmail: row.workplace_email, workplaceLogo: row.workplace_logo,
				resetOtpHash: row.reset_otp_hash, resetOtpExpiresAt: asIso(row.reset_otp_expires_at),
				createdAt: asIso(row.created_at),
			}));
			data.patients = patients.map((row) => ({
				id: row.id, name: row.name, age: row.age, sex: row.sex, email: row.email,
				historyNotes: row.history_notes, ownerUserId: row.owner_user_id,
				createdAt: asIso(row.created_at),
			}));
			data.consultations = consultations.map((row) => ({
				id: row.id, patientId: row.patient_id, doctorName: row.doctor_name,
				ownerUserId: row.owner_user_id,
				status: row.status, startedAt: asIso(row.started_at), endedAt: asIso(row.ended_at),
				transcript: row.transcript || [], vitals: row.vitals || [], aiDraft: row.ai_draft,
				finalReport: row.final_report, feedback: row.feedback || [],
			}));
		},
		async write() {
			await sql`DELETE FROM consultations`;
			await sql`DELETE FROM patients`;
			await sql`DELETE FROM users`;
			for (const user of data.users) {
				await sql`INSERT INTO users (id, name, email, password_hash, google_id, avatar, specialty, workplace_type, workplace_name, workplace_address, workplace_phone, workplace_email, workplace_logo, reset_otp_hash, reset_otp_expires_at, created_at)
					VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash || null}, ${user.googleId || null}, ${user.avatar || null}, ${user.specialty || null}, ${user.workplaceType || null}, ${user.workplaceName || null}, ${user.workplaceAddress || null}, ${user.workplacePhone || null}, ${user.workplaceEmail || null}, ${user.workplaceLogo || null}, ${user.resetOtpHash || null}, ${user.resetOtpExpiresAt || null}, ${user.createdAt || new Date().toISOString()})`;
			}
			for (const patient of data.patients) {
				await sql`INSERT INTO patients (id, name, age, sex, email, history_notes, owner_user_id, created_at)
					VALUES (${patient.id}, ${patient.name}, ${patient.age}, ${patient.sex || null}, ${patient.email || null}, ${patient.historyNotes || ''}, ${patient.ownerUserId || null}, ${patient.createdAt || new Date().toISOString()})`;
			}
			for (const consultation of data.consultations) {
				await sql`INSERT INTO consultations (id, patient_id, owner_user_id, doctor_name, status, started_at, ended_at, transcript, vitals, ai_draft, final_report, feedback)
					VALUES (${consultation.id}, ${consultation.patientId}, ${consultation.ownerUserId || null}, ${consultation.doctorName}, ${consultation.status}, ${consultation.startedAt}, ${consultation.endedAt}, ${JSON.stringify(consultation.transcript || [])}::jsonb, ${JSON.stringify(consultation.vitals || [])}::jsonb, ${consultation.aiDraft ? JSON.stringify(consultation.aiDraft) : null}::jsonb, ${consultation.finalReport ? JSON.stringify(consultation.finalReport) : null}::jsonb, ${JSON.stringify(consultation.feedback || [])}::jsonb)`;
			}
		},
	};
}

export const db = databaseUrl
	? await createNeonDb()
	: await JSONFilePreset(file, defaultData);
