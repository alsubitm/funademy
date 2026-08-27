import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const RETRY_DELAYS_MS = process.env.VITEST ? [0, 0] : [150, 500];

export function isTransientDatabaseError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P1001', 'P1002', 'P1017', 'P2024'].includes(error.code)
  ) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /(?:P1001|P1002|P1017|P2024|57P01|terminating connection due to administrator command|server has closed the connection unexpectedly|connection (?:reset|terminated|refused)|can(?:'|’)t reach database server|timed? out)/i.test(
    message,
  );
}

type RetryOptions = {
  operation: string;
  kind?: 'read' | 'transaction';
  delaysMs?: readonly number[];
  onRetry?: (attempt: number, error: unknown) => void;
};

function isSafeTransactionRetryError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P1001', 'P1002', 'P2024'].includes(error.code)
  ) return true;
  const message = error instanceof Error ? error.message : String(error);
  // These failures happen before a commit can succeed: PostgreSQL explicitly
  // terminated/aborted the backend, or no server connection was established.
  return /(?:P1001|P1002|P2024|57P01|terminating connection due to administrator command|can(?:'|’)t reach database server)/i.test(
    message,
  );
}

/**
 * Retry an operation only for short-lived connection failures.
 *
 * Callers must pass either a read or a complete database transaction whose
 * effects are atomic/idempotent. Never wrap a payment-provider call here:
 * its outcome can be unknown after a network failure.
 */
export async function withDbRetry<T>(
  work: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const delays = options.delaysMs ?? RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await work();
      globalThis.__yeDbOutageStartedAt = undefined;
      return result;
    } catch (error) {
      const retryable =
        options.kind === 'transaction'
          ? isSafeTransactionRetryError(error)
          : isTransientDatabaseError(error);
      if (!retryable || attempt >= delays.length) {
        if (retryable) {
          void import('@/lib/dbOutageAlert')
            .then((m) => m.maybeSendDbOutageAlert(options.operation))
            .catch(() => {});
        }
        throw error;
      }
      options.onRetry?.(attempt + 1, error);
      console.warn(
        `[db] transient failure in ${options.operation}; retry ${attempt + 1}/${delays.length}`,
      );
      const delay = delays[attempt];
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
