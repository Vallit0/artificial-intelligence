// ============================================
// API Client (replaces Supabase client)
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || '';

type AuthChangeCallback = (user: ApiUser | null) => void;

export interface ApiUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  examenFinalEnabled?: boolean;
  examenObjecionesEnabled?: boolean;
  level2Unlocked?: boolean;
  courseCompleted?: boolean;
  // false mientras el usuario no haya visto/saltado el tour del primer login.
  tutorialCompleted?: boolean;
  // Sólo presentes en la respuesta de /auth/me (datos de display).
  sede?: { id: string; name: string } | null;
  coach?: { id: string; name: string } | null;
  division?: { id: string; name: string } | null;
  coachPermissions?: {
    canCreateCoaches: boolean;
    canEditPrompts: boolean;
    // Da acceso al panel admin global (atraviesa sedes, como un admin).
    canAccessAdmin: boolean;
  };
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private authChangeCallbacks: AuthChangeCallback[] = [];
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  // ============================================
  // Token Management
  // ============================================

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.notifyAuthChange(null);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  hasTokens(): boolean {
    return !!this.accessToken;
  }

  // ============================================
  // Auth State Listeners
  // ============================================

  onAuthChange(callback: AuthChangeCallback): () => void {
    this.authChangeCallbacks.push(callback);
    return () => {
      this.authChangeCallbacks = this.authChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyAuthChange(user: ApiUser | null) {
    this.authChangeCallbacks.forEach(cb => cb(user));
  }

  // ============================================
  // HTTP Methods
  // ============================================

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }

  // Raw fetch for special content types (SDP, etc.)
  async rawFetch(path: string, options: RequestInit): Promise<Response> {
    const url = `${API_BASE}${path}`;
    return fetch(url, options);
  }

  // ============================================
  // Core Request Method
  // ============================================

  // Status codes considerados transitorios — vale la pena reintentar con backoff.
  // 429 = rate-limited por Nginx (limit_req_status), 502/503/504 = upstream
  // o backend saturado. POST/PUT/PATCH/DELETE NO se reintentan por defecto
  // para no duplicar mutaciones; sólo GETs.
  private readonly TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
  private readonly MAX_RETRIES = 2;

  private async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const isIdempotent = method === 'GET' || method === 'HEAD';
    let response: Response;
    let attempt = 0;
    while (true) {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Reintento sólo en GET (no queremos duplicar POSTs/PATCH/DELETE).
      if (
        isIdempotent &&
        this.TRANSIENT_STATUSES.has(response.status) &&
        attempt < this.MAX_RETRIES
      ) {
        const backoff = 200 * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((res) => setTimeout(res, backoff));
        attempt++;
        continue;
      }
      break;
    }

    // Handle 401 with token refresh
    if (response.status === 401 && retry && this.refreshToken) {
      try {
        const newToken = await this.refreshAccessToken();
        this.accessToken = newToken;
        localStorage.setItem('access_token', newToken);
        return this.request<T>(method, path, body, false);
      } catch {
        this.clearTokens();
        throw new ApiError('Session expired', 401);
      }
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new ApiError(data.error || `Request failed: ${response.status}`, response.status);
    }

    return response.json();
  }

  // ============================================
  // Token Refresh
  // ============================================

  private async refreshAccessToken(): Promise<string> {
    // Deduplicate concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Refresh failed');
        }

        const data = await response.json();
        return data.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

// ============================================
// Error Class
// ============================================

export class ApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Singleton instance
export const api = new ApiClient();
