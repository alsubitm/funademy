// Analytics only: an approximate per-process global ceiling needs no DB lock.
let startedAt = 0;
let hits = 0;
export function allowGlobalClick(now = Date.now()) {
  if (now - startedAt >= 60_000) { startedAt = now; hits = 0; }
  if (hits >= 600) return false;
  hits++;
  return true;
}
