// ============================================
// API Client - Replaces Supabase client
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Load tokens from localStorage on init
if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('accessToken');
  refreshToken = localStorage.getItem('refreshToken');
}

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const getAccessToken = () => accessToken;

// Generic fetch wrapper with auth
const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If unauthorized and we have refresh token, try to refresh
  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const { accessToken: newAccessToken } = await refreshResponse.json();
      accessToken = newAccessToken;
      localStorage.setItem('accessToken', newAccessToken);

      // Retry original request
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      // Refresh failed, clear tokens
      clearTokens();
    }
  }

  return response;
};

// ============================================
// Auth API
// ============================================
export const authApi = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async signup(email: string, password: string, firstName?: string, lastName?: string) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      clearTokens();
    }
  },

  async getMe() {
    const response = await fetchWithAuth('/auth/me');
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    return response.json();
  },

  isAuthenticated() {
    return !!accessToken;
  },
};

// ============================================
// Scenarios API
// ============================================
export const scenariosApi = {
  async getAll() {
    const response = await fetchWithAuth('/api/scenarios');
    if (!response.ok) throw new Error('Failed to fetch scenarios');
    return response.json();
  },

  async getById(id: string) {
    const response = await fetchWithAuth(`/api/scenarios/${id}`);
    if (!response.ok) throw new Error('Failed to fetch scenario');
    return response.json();
  },
};

// ============================================
// Progress API
// ============================================
export const progressApi = {
  async getMyProgress() {
    const response = await fetchWithAuth('/api/progress');
    if (!response.ok) throw new Error('Failed to fetch progress');
    return response.json();
  },

  async updateProgress(scenarioId: string, data: {
    isCompleted?: boolean;
    score?: number;
  }) {
    const response = await fetchWithAuth(`/api/progress/${scenarioId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return response.json();
  },
};

// ============================================
// Practice Sessions API
// ============================================
export const sessionsApi = {
  async getAll() {
    const response = await fetchWithAuth('/api/sessions');
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
  },

  async create(data: {
    durationSeconds: number;
    rating?: number;
    scenarioId?: string;
  }) {
    const response = await fetchWithAuth('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create session');
    return response.json();
  },

  async update(id: string, data: {
    durationSeconds?: number;
    score?: number;
    passed?: boolean;
    aiFeedback?: string;
  }) {
    const response = await fetchWithAuth(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update session');
    return response.json();
  },

  async evaluate(sessionId: string, data: {
    transcript: Array<{ role: string; content: string }>;
    scenarioId?: string;
    durationSeconds: number;
  }) {
    const response = await fetchWithAuth('/api/sessions/evaluate', {
      method: 'POST',
      body: JSON.stringify({ sessionId, ...data }),
    });
    if (!response.ok) throw new Error('Failed to evaluate session');
    return response.json();
  },

  async getStats() {
    const response = await fetchWithAuth('/api/sessions/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },
};

// ============================================
// ElevenLabs API
// ============================================
export const elevenlabsApi = {
  async getConversationToken(scenarioId?: string) {
    const response = await fetchWithAuth('/api/elevenlabs/conversation-token', {
      method: 'POST',
      body: JSON.stringify({ scenarioId }),
    });
    if (!response.ok) throw new Error('Failed to get conversation token');
    return response.json();
  },

  async saveAgentEvaluation(sessionId: string, evaluation: {
    score: number;
    passed: boolean;
    feedback: string;
    breakdown?: Record<string, number>;
  }) {
    const response = await fetchWithAuth('/api/elevenlabs/agent-evaluation', {
      method: 'POST',
      body: JSON.stringify({ sessionId, ...evaluation }),
    });
    if (!response.ok) throw new Error('Failed to save evaluation');
    return response.json();
  },
};

export default {
  auth: authApi,
  scenarios: scenariosApi,
  progress: progressApi,
  sessions: sessionsApi,
  elevenlabs: elevenlabsApi,
};
