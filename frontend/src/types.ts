export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  specialty?: string | null;
  workplaceType?: 'hospital' | 'clinic' | null;
  workplaceName?: string | null;
  workplaceAddress?: string | null;
  workplacePhone?: string | null;
  workplaceEmail?: string | null;
  workplaceLogo?: string | null;
}

export type Speaker = 'doctor' | 'patient' | 'conversation';

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

export interface PatientProblem {
  problem: string;
  duration: string;
  severity: string;
}

export interface ActionItem {
  item: string;
  source: 'doctor_mentioned' | 'ai_suggested';
}

export interface ReportDraft {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  differential: DifferentialItem[];
  plan: string[];
  suggestedQuestions: string[];
  patientProblems?: PatientProblem[];
  querySummary?: string;
  predictedProblems?: Array<{ label: string; severity: 'mild' | 'moderate' | 'severe' | 'not_specified'; confidence: 'low' | 'medium' | 'high'; rationale: string }>;
  suggestedActionItems?: ActionItem[];
  nextCheckup?: { date: string; instruction: string };
  generatedBy?: string;
  generatedAt?: string;
  approvedAt?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  sex: string | null;
  email: string | null;
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
    patientProblems: (raw.patientProblems ?? []).map((item: any) => {
      const duration = String(item.duration ?? 'Not mentioned');
      const severity = String(item.severity ?? 'Not mentioned');
      const severityWords = new Set(['mild', 'moderate', 'severe', 'not mentioned', 'not specified']);
      const looksLikeDuration = /\b(?:hour|hours|day|days|week|weeks|month|months|year|years)\b/i.test(severity);
      const looksLikeSeverity = severityWords.has(duration.trim().toLowerCase());
      
      
      
      if (looksLikeSeverity && looksLikeDuration) {
        return { ...item, duration: severity, severity: duration };
      }
      return { ...item, duration, severity };
    }),
    suggestedActionItems: raw.suggestedActionItems ?? [],
    nextCheckup: raw.nextCheckup ?? { date: '', instruction: 'Not specified' },
    predictedProblems: (raw.predictedProblems ?? []).map((item: any) => ({
      label: item.label ?? item.condition ?? '',
      severity: item.severity ?? 'moderate',
      confidence: item.confidence ?? 'low',
      rationale: item.rationale ?? '',
    })),
    generatedBy: raw.generatedBy,
    generatedAt: raw.generatedAt,
    approvedAt: raw.approvedAt,
  };
}
