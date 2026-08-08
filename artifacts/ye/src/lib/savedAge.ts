// Persist the visitor's selected child age across pages (per browser tab session).
const KEY = 'ye:selectedAge';

export function getSavedAge(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 4 && n <= 18 ? n : null;
  } catch {
    return null;
  }
}

export function saveAge(age: number | null) {
  if (typeof window === 'undefined') return;
  try {
    if (age === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, String(age));
  } catch {
    // storage unavailable — ignore
  }
}
