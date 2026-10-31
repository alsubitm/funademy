import { spawn } from 'node:child_process';
import setup from '../src/tests/global-setup';
import { testDbUrl } from '../src/tests/test-db';

async function main() {
  const databaseUrl = testDbUrl(); // fail closed before provisioning or starting Next
  await setup();
  // Whitelist, rather than inherit provider credentials from the workspace.
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'NODE_EXTRA_CA_CERTS'].flatMap(key =>
      process.env[key] ? [[key, process.env[key]!]] : []),
  );
  const child = spawn('pnpm', ['exec', 'next', 'dev', '-H', '127.0.0.1', '-p', '3107'], {
    stdio: 'inherit',
    env: {
      ...env, NODE_ENV: 'development', DATABASE_URL: databaseUrl,
      SESSION_SECRET: 'browser-regression-only-secret',
      ADMIN_PASSWORD: 'browser-regression-only-password',
      NEXT_DIST_DIR: '.next-browser-test',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', code => process.exit(code ?? 1));
}
main().catch(() => { console.error('Browser test server setup failed'); process.exit(1); });
