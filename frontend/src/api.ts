import type {
  Patient,
  Consultation,
  Note,
  Speaker,
  VitalReading,
  ReportDraft,
  User,
} from './types';

const BASE = '/api';
const TOKEN_KEY = 'consult-scribe-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(
      new Event('auth:unauthorized')
    );
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({}));

    throw new ApiError(
      body.error ||
        `Request failed: ${res.status}`,
      body.code
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  // ==========================================
  // AUTH
  // ==========================================

  register: (data: {
    name: string;
    email: string;
    password: string;
  }) =>
    request<{
      token: string;
      user: User;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: {
    email: string;
    password: string;
  }) =>
    request<{
      token: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  google: (credential: string) =>
    request<{
      token: string;
      user: User;
    }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential,
      }),
    }),

  me: () =>
    request<User>('/auth/me'),

  forgotPassword: (email: string) =>
    request<{
      ok: boolean;
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email,
      }),
    }),

  resetPassword: (data: {
    email: string;
    otp: string;
    newPassword: string;
  }) =>
    request<{
      ok: boolean;
    }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAvatar: (avatar: string) =>
    request<User>('/auth/avatar', {
      method: 'PATCH',
      body: JSON.stringify({
        avatar,
      }),
    }),

  updateProfile: (data: {
    specialty?: string;
    workplaceType?:
      | 'hospital'
      | 'clinic'
      | null;
    workplaceName?: string;
    workplaceAddress?: string;
    workplacePhone?: string;
    workplaceEmail?: string;
    workplaceLogo?: string | null;
  }) =>
    request<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // ==========================================
  // PATIENTS
  // ==========================================

  listPatients: () =>
    request<Patient[]>('/patients'),

  createPatient: (
    data: Partial<Patient>
  ) =>
    request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPatient: (id: string) =>
    request<Patient>(
      `/patients/${id}`
    ),

  /*
   * Permanently delete a patient.
   *
   * The backend also removes all consultations
   * belonging to this patient.
   */
  deletePatient: (id: string) =>
    request<{
      success: boolean;
      message: string;

      deletedPatient: {
        id: string;
        name: string;
      };

      deletedConsultations: number;

      deletedConsultationIds: string[];
    }>(`/patients/${id}`, {
      method: 'DELETE',
    }),

  // ==========================================
  // CONSULTATIONS
  // ==========================================

  startConsultation: (
    patientId: string,
    doctorName: string
  ) =>
    request<Consultation>(
      '/consultations',
      {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          doctorName,
        }),
      }
    ),

  getConsultation: (id: string) =>
    request<Consultation>(
      `/consultations/${id}`
    ),

  addTranscriptLine: (
    id: string,
    speaker: Speaker,
    text: string
  ) =>
    request<Consultation>(
      `/consultations/${id}/transcript`,
      {
        method: 'POST',
        body: JSON.stringify({
          speaker,
          text,
        }),
      }
    ),

  // ==========================================
  // AUDIO / TRANSCRIPTION
  // ==========================================

  uploadConsultationAudio: async (
    id: string,
    blob: Blob,
    opts?: {
      speaker?: Speaker;
      lang?: string;
      mode?: 'local' | 'online';
    }
  ) => {
    const token = getToken();

    const params =
      new URLSearchParams();

    params.set(
      'speaker',
      opts?.speaker ||
        'conversation'
    );

    if (opts?.lang) {
      params.set(
        'lang',
        opts.lang
      );
    }

    if (opts?.mode) {
      params.set(
        'mode',
        opts.mode
      );
    }

    const res = await fetch(
      `${BASE}/consultations/${id}/audio?${params.toString()}`,
      {
        method: 'POST',

        headers: {
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {}),

          'Content-Type':
            blob.type ||
            'audio/webm',
        },

        body: blob,
      }
    );

    if (res.status === 401) {
      clearToken();

      window.dispatchEvent(
        new Event(
          'auth:unauthorized'
        )
      );
    }

    if (!res.ok) {
      const body = await res
        .json()
        .catch(() => ({}));

      throw new ApiError(
        body.error ||
          `Request failed: ${res.status}`,
        body.code
      );
    }

    return res.json() as Promise<Consultation>;
  },

  // ==========================================
  // VITALS
  // ==========================================

  addVital: (
    id: string,
    reading: Omit<
      VitalReading,
      'at'
    >
  ) =>
    request<Consultation>(
      `/consultations/${id}/vitals`,
      {
        method: 'POST',
        body: JSON.stringify(
          reading
        ),
      }
    ),

  // ==========================================
  // AI / REPORT
  // ==========================================

  endConsultation: (id: string) =>
    request<Consultation>(
      `/consultations/${id}/end`,
      {
        method: 'POST',
      }
    ),

  /*
   * Doctor approval.
   *
   * IMPORTANT:
   * finalReport is the doctor's approved
   * version of the AI suggestion.
   */
  approveConsultation: (
    id: string,
    finalReport: ReportDraft
  ) =>
    request<Consultation>(
      `/consultations/${id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          finalReport,
        }),
      }
    ),

  /*
   * Send the EXACT PDF generated by the
   * frontend from the approved report.
   *
   * pdfBase64 is intentionally the
   * third argument.
   */
  emailReport: (
    id: string,
    to?: string,
    pdfBase64?: string
  ) =>
    request<{
      sent: boolean;
      preview: boolean;
      to: string;
      body?: string;
      error?: string;
    }>(
      `/consultations/${id}/email`,
      {
        method: 'POST',

        body: JSON.stringify({
          to,
          pdfBase64,
        }),
      }
    ),

  // ==========================================
  // NOTES / REPORTS
  // ==========================================

  listNotes: () =>
    request<Note[]>(
      '/consultations'
    ),

  listActiveConsultations: () =>
    request<Note[]>(
      '/consultations/active'
    ),

  deleteNote: (id: string) =>
    request<void>(
      `/consultations/${id}`,
      {
        method: 'DELETE',
      }
    ),

  regenerateDraft: (id: string) =>
    request<Consultation>(
      `/consultations/${id}/regenerate`,
      {
        method: 'POST',
      }
    ),

  refineDraft: (
    id: string,
    draft: ReportDraft,
    instruction: string
  ) =>
    request<ReportDraft>(
      `/consultations/${id}/refine`,
      {
        method: 'POST',

        body: JSON.stringify({
          draft,
          instruction,
        }),
      }
    ),

  // ==========================================
  // AI FEEDBACK
  // ==========================================

  sendFeedback: (
    id: string,
    rating: 'up' | 'down'
  ) =>
    request<{
      ok: boolean;
    }>(
      `/consultations/${id}/feedback`,
      {
        method: 'POST',

        body: JSON.stringify({
          rating,
        }),
      }
    ),

  // ==========================================
  // SYSTEM STATUS
  // ==========================================

  getStatus: () =>
    request<{
      llmConfigured: boolean;
      sttConfigured: boolean;
      localWhisperConfigured: boolean;
      emailConfigured: boolean;
    }>('/status'),
};