export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

export type Speaker = 'doctor' | 'patient';

export interface TranscriptLine {
  speaker: Speaker;
  text: string;
  at: string;
}

export type VitalType = 'spo2' | 'pulse' | 'temp';

export interface VitalReading {
  type: VitalType;
  value: number;
  unit: string;
  source: 'manual' | 'device';
  at: string;
}

export interface DifferentialItem {
  condition: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface ReportDraft {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  differential: DifferentialItem[];
  plan: string[];
  suggestedQuestions: string[];
  generatedBy?: string;
  generatedAt?: string;
  approvedAt?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  sex: string | null;
  historyNotes: string;
  createdAt: string;
  consultations?: Consultation[];
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorName: string;
  status: 'active' | 'review' | 'approved';
  startedAt: string;
  endedAt: string | null;
  transcript: TranscriptLine[];
  vitals: VitalReading[];
  aiDraft: ReportDraft | null;
  finalReport: ReportDraft | null;
  feedback?: { rating: 'up' | 'down'; at: string }[];
}

export type Note = Consultation & { patientName: string };

// Consultations created before the SOAP-format rewrite have drafts in the
// old shape (summary/symptoms/actionItems) and are missing differential/plan
// arrays entirely. Normalizing on load means every page can trust the shape
// instead of every .map() call needing its own `|| []` guard.
export function normalizeDraft(raw: Partial<ReportDraft> | null | undefined): ReportDraft | null {
  if (!raw) return null;
  return {
    chiefComplaint: raw.chiefComplaint ?? '',
    subjective: raw.subjective ?? '',
    objective: raw.objective ?? '',
    assessment: raw.assessment ?? '',
    differential: raw.differential ?? [],
    plan: raw.plan ?? [],
    suggestedQuestions: raw.suggestedQuestions ?? [],
    generatedBy: raw.generatedBy,
    generatedAt: raw.generatedAt,
    approvedAt: raw.approvedAt,
  };
}
