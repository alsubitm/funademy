import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invitationRetry } from '../lib/live-invitation-retry';

let saved: Map<string, string>;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('recovers a pending key from storage and clears only confirmed attempts', async () => {
  const first = await invitationRetry('room-one', 'Student', 'guardian@example.invalid');
  const retry = await invitationRetry('room-one', ' Student ', 'GUARDIAN@example.invalid');
  expect(retry.key).toBe(first.key);
  const sibling = await invitationRetry('room-one', 'Sibling', 'guardian@example.invalid');
  const otherRoom = await invitationRetry('room-two', 'Student', 'guardian@example.invalid');
  expect(sibling.key).not.toBe(first.key);
  expect(otherRoom.key).not.toBe(first.key);
  expect(JSON.stringify([...saved])).not.toContain('guardian');
  expect(JSON.stringify([...saved])).not.toContain('Student');
  retry.complete();
  expect(saved.size).toBe(2);
  expect((await invitationRetry('room-one', 'Student', 'guardian@example.invalid')).key).not.toBe(first.key);
});

it('rejects before sending when browser storage cannot persist the key', async () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => { throw new Error('storage unavailable'); },
  });
  await expect(invitationRetry('room-one', 'Student', 'guardian@example.invalid')).rejects.toThrow('storage unavailable');
});
