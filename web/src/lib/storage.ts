/** Preferences only. Every access is wrapped: the app must work when storage is blocked or empty. */
export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(`asterism:${key}`);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(`asterism:${key}`, value);
  } catch {
    /* storage unavailable: preference is kept for this page view only */
  }
}
