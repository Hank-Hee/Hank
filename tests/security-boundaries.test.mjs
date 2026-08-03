import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const allowedEnvironmentFiles = new Set(['.dev.vars.example', '.env.example', '.env.test']);

function assertSafeTrackedName(path) {
  const basename = path.split('/').at(-1) ?? path;
  const lower = basename.toLowerCase();
  const looksLikeEnvironment =
    lower === '.dev.vars' || lower.startsWith('.dev.vars.') ||
    lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env');
  if (looksLikeEnvironment) {
    assert.ok(allowedEnvironmentFiles.has(lower), `tracked environment file: ${path}`);
  }
  assert.doesNotMatch(basename, /(^|[._-])(credentials?|secrets?)([._-]|$)/i);
}

function assertSafeText(content) {
  assert.doesNotMatch(content, /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(
    content,
    /^(?:CLOUDFLARE_API_TOKEN|DATABASE_URL|R2_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY)=\S+/m,
  );
}

test('tracked source excludes local secret files and obvious credential material', async () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);

  for (const path of tracked) {
    assertSafeTrackedName(path);
    const content = await readFile(resolve(repositoryRoot, path));
    if (!content.includes(0)) assertSafeText(content.toString('utf8'));
  }
});

test('secret scanner covers deceptive names and credential content', () => {
  for (const path of ['apps/api/.dev.vars', 'prod.env', 'credentials.txt', 'release-secrets']) {
    assert.throws(() => assertSafeTrackedName(path));
  }
  for (const path of ['.env.example', '.env.test', '.dev.vars.example', 'docs/security.md']) {
    assert.doesNotThrow(() => assertSafeTrackedName(path));
  }
  assert.throws(() => assertSafeText(['CLOUDFLARE_API', 'TOKEN=real-looking-value'].join('_')));
  assert.throws(() => assertSafeText(['-----BEGIN', 'PRIVATE KEY-----'].join(' ')));
});

test('foundation migration validates app_runtime without protected role repairs', async () => {
  const migration = await readFile(
    resolve(repositoryRoot, 'supabase/migrations/202607310001_platform_foundation.sql'),
    'utf8',
  );

  assert.doesNotMatch(migration, /alter\s+role\s+app_runtime/i);
  assert.match(migration, /app_runtime role attributes are unsafe/i);
  assert.match(
    migration,
    /grant\s+app_runtime\s+to\s+current_user\s+with\s+set\s+true,\s*inherit\s+false/i,
  );
});
