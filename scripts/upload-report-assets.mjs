import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const options = parseArguments(process.argv.slice(2));
const manifestPath = requiredPath(options, '--manifest');
const bucket = options.get('--bucket') ?? 'wison-knowledge-files-uat';
const objectSet = options.get('--object-set') ?? 'objects';
if (!['objects', 'quarantineObjects'].includes(objectSet)) throw new Error('Object set must be objects or quarantineObjects.');
const checkpointPath = resolve(options.get('--checkpoint') ?? 'work/report-asset-upload-checkpoint.json');
const concurrency = Number(options.get('--concurrency') ?? 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Concurrency must be between 1 and 8.');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const checkpoint = await readCheckpoint(checkpointPath);
const selectedObjects = manifest[objectSet] ?? [];
const pending = selectedObjects.filter(({ objectKey }) => !checkpoint.uploaded.includes(objectKey));
const uploaded = new Set(checkpoint.uploaded);
let completed = 0;

for (let start = 0; start < pending.length; start += concurrency) {
  const batch = pending.slice(start, start + concurrency);
  await Promise.all(batch.map(async (object) => {
    const actualHash = await hashFile(object.sourcePath);
    if (actualHash !== object.sha256) throw new Error(`Source checksum changed: ${object.sourcePath}`);
    await uploadWithRetry(object, bucket, 3);
    uploaded.add(object.objectKey);
    completed++;
  }));
  await writeCheckpoint(checkpointPath, [...uploaded].sort());
  if (completed % 20 === 0 || completed === pending.length) {
    console.log(JSON.stringify({ completed, pending: pending.length, total: selectedObjects.length, objectSet }));
  }
}

console.log(JSON.stringify({ bucket, uploaded: completed, skipped: checkpoint.uploaded.length, total: selectedObjects.length, objectSet }));

async function uploadWithRetry(object, targetBucket, attempts) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await runWrangler([
        'r2', 'object', 'put', `${targetBucket}/${object.objectKey}`,
        '--remote', '--force', '--file', object.sourcePath,
        '--content-type', object.mimeType,
        '--cache-control', object.mimeType.startsWith('image/')
          ? 'public, max-age=604800, immutable' : 'private, max-age=0, no-store',
      ]);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function runWrangler(arguments_) {
  const executable = resolve('node_modules/.bin/wrangler');
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, arguments_, {
      cwd: resolve('.'),
      env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      rejectPromise(new Error(`wrangler timed out after 60 seconds: ${arguments_[2] ?? 'R2 upload'}`));
    }, 60_000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`wrangler exited ${code}: ${output.slice(-2_000)}`));
    });
  });
}

async function readCheckpoint(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return { uploaded: Array.isArray(value.uploaded) ? value.uploaded : [] };
  } catch (error) {
    if (error?.code === 'ENOENT') return { uploaded: [] };
    throw error;
  }
}

async function writeCheckpoint(path, uploaded) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, uploaded }, null, 2)}\n`);
  await rename(temporary, path);
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function parseArguments(values) {
  const parsed = new Map();
  for (const value of values) {
    const separator = value.indexOf('=');
    if (!value.startsWith('--') || separator < 3) throw new Error(`Invalid argument: ${value}`);
    parsed.set(value.slice(0, separator), value.slice(separator + 1));
  }
  return parsed;
}
function requiredPath(arguments_, name) {
  const value = arguments_.get(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return resolve(value);
}
