import { spawn } from 'node:child_process';

// Do not pass database/provider secrets into either Vite process.
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'LD_LIBRARY_PATH'].filter(k => process.env[k]).map(k => [k, process.env[k]]),
);
Object.assign(env, { NODE_ENV: 'production', PORT: '4178', BASE_PATH: '/windmill/' });
let child;
const run = args => new Promise((resolve, reject) => {
  child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...args], { env, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Vite exited ${code}`)));
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { child?.kill(signal); process.exit(0); });
}
await run(['build', '--config', 'vite.config.ts']);
await run(['preview', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--strictPort']);
