const STORAGE_KEY = 'owm_access_token';

let token: string | null = localStorage.getItem(STORAGE_KEY);

export function getAuthToken(): string | null {
  return token;
}

export function setAuthToken(next: string | null): void {
  token = next;

  if (next) {
    localStorage.setItem(STORAGE_KEY, next);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
