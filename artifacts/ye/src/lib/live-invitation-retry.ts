// A tab-scoped journal survives refresh without retaining plaintext student details.
// Persist BEFORE sending: if storage is unavailable, callers must not send a
// request whose retry identity would be lost on refresh.
export async function invitationRetry(roomId: string, name: string, email: string) {
  const signature = new TextEncoder().encode(JSON.stringify([roomId, name.trim(), email.trim().toLowerCase()]));
  const digest = await crypto.subtle.digest('SHA-256', signature);
  const storageKey = `ye:live-invitation:v1:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
  const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
  sessionStorage.setItem(storageKey, key);
  return {
    key,
    complete: () => sessionStorage.removeItem(storageKey),
  };
}
