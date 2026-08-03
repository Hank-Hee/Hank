import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const origin = 'http://127.0.0.1:8791';
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

async function waitForWorker(server, output) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (attempt > 0 && server.pid === undefined) {
      throw new Error(`Wrangler could not start.\n${output()}`);
    }
    if (server.exitCode !== null) {
      throw new Error(`Wrangler exited before readiness.\n${output()}`);
    }
    try {
      const response = await fetch(`${origin}/api/v1/health`);
      if (response.ok) return;
      lastError = new Error(`Health readiness returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Wrangler did not become ready: ${String(lastError)}\n${output()}`);
}

test('built Worker serves the SPA and strict API from one origin', { timeout: 45_000 }, async (t) => {
  let output = '';
  let spawnError;
  const server = spawn(
    'npm',
    [
      'exec', '--workspace', '@wison/api', 'wrangler', '--',
      'dev', 'dist/index.js', '--no-bundle', '--local', '--port', '8791',
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  server.on('error', (error) => { spawnError = error; });

  t.after(async () => {
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await Promise.race([exited, delay(5_000)]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
  });

  await waitForWorker(server, () => `${String(spawnError ?? '')}\n${output}`);

  const [rootPackage, home, deepLink, health, missing] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
    fetch(`${origin}/`),
    fetch(`${origin}/reports`),
    fetch(`${origin}/api/v1/health`),
    fetch(`${origin}/api/v1/not-a-route`),
  ]);

  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type') ?? '', /text\/html/);
  for (const response of [home, deepLink]) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
  }
  assert.match(await deepLink.text(), /<div id="root"><\/div>/);

  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type') ?? '', /application\/json/);
  const healthBody = await health.json();
  assert.deepEqual(Object.keys(healthBody).sort(), ['service', 'status', 'timestamp', 'version']);
  assert.equal(healthBody.status, 'ok');
  assert.equal(healthBody.service, 'api');
  assert.equal(healthBody.version, rootPackage.version);
  assert.match(healthBody.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type') ?? '', /application\/json/);
  const missingBody = await missing.json();
  assert.deepEqual(Object.keys(missingBody), ['error']);
  assert.equal(missingBody.error.code, 'NOT_FOUND');
  assert.match(missingBody.error.requestId, /^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/);
});
