import { spawn } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run the company demo with npm run dev.');

const children = ['dev:api', 'dev:web'].map((script) => spawn(
  process.execPath,
  [npmCli, 'run', script],
  { stdio: 'inherit', env: process.env },
));

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

const exitCode = await new Promise((resolve) => {
  for (const child of children) {
    child.once('error', () => {
      stop('SIGTERM');
      resolve(1);
    });
    child.once('exit', (code, signal) => {
      if (!stopping && code !== 0) stop('SIGTERM');
      if (!stopping || signal === null) resolve(code ?? 0);
    });
  }
});

process.exitCode = exitCode;
