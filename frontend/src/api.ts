import type {
  Patient,
  Consultation,
  Note,
  Speaker,
  VitalReading,
  ReportDraft,
  User,
} from './types';

const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

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
  options?: RequestInit,
  timeoutMs = 20_000
): Promise<T> {
  const token = getToken();

  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let res: Response;

  const isFormData =
    typeof FormData !== 'undefined' &&
    options?.body instanceof FormData;

  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(isFormData
          ? {}
          : {
              'Content-Type': 'application/json',
            }),
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (
      err instanceof DOMException &&
      err.name === 'AbortError'
    ) {
      throw new ApiError(
        'The server took too long to respond. Please try again.'
      );
    }

    throw err;
  } finally {
    window.clearTimeout(timeout);
  }

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

  transcribeAudio: (
    id: string,
    audio: Blob,
    language?: string
  ) => {
    const query = language
      ? `?language=${encodeURIComponent(language)}`
      : '';

    return request<{
      text: string;
      language?: string;
      duration?: number;
    }>(
      `/consultations/${id}/transcribe${query}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            audio.type || 'audio/webm',
        },
        body: audio,
      },
      90_000
    );
  },

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

  endConsultation: (id: string) =>
    request<Consultation>(
      `/consultations/${id}/end`,
      {
        method: 'POST',
      }
    ),

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

  getStatus: () =>
    request<{
      llmConfigured: boolean;
      sttConfigured: boolean;
      emailConfigured: boolean;
    }>('/status'),
};