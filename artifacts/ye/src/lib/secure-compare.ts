import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time secret comparison. Both sides are hashed first so inputs of
 * different lengths compare in constant time too (a bare timingSafeEqual
 * throws on length mismatch, and `!==` leaks how many leading bytes match).
 */
export function secretsEqual(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
