const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'johen_api_token';

export const getApiToken = () => localStorage.getItem(TOKEN_KEY);
export const setApiToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearApiToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  const token = getApiToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {...options, headers});
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Permintaan ke server gagal.');
  return payload as T;
}
