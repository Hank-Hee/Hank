import { pathToFileURL } from 'node:url';

const defaultPaths = [
  '/api/v1/companies',
  '/api/v1/companies/shell',
  '/api/v1/reports',
];

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

function validateTarget(baseUrl) {
  const target = new URL(baseUrl);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && loopback)) {
    throw new Error('UAT load targets must use HTTPS; HTTP is allowed only for loopback testing.');
  }
  if (target.username || target.password || target.search || target.hash) {
    throw new Error('Base URL must be an origin without credentials, query parameters or fragments.');
  }
  return target;
}

export async function runReadOnlyLoad({
  baseUrl,
  concurrency = 20,
  requests = 200,
  paths = defaultPaths,
  accessToken,
  accessClientId,
  accessClientSecret,
  fetchImpl = fetch,
  maxP95Ms = 500,
  maxErrorRatePercent = 1,
}) {
  const target = validateTarget(baseUrl);
  if (!Number.isInteger(concurrency) || concurrency < 20 || concurrency > 100) {
    throw new Error('Concurrency must be an integer from 20 through 100.');
  }
  if (!Number.isInteger(requests) || requests < concurrency) {
    throw new Error('Request count must be an integer at least as large as concurrency.');
  }
  if (!Array.isArray(paths) || !paths.length || paths.some((path) => !path.startsWith('/api/v1/'))) {
    throw new Error('Every load path must be a read-only /api/v1/ route.');
  }
  if (Boolean(accessClientId) !== Boolean(accessClientSecret)) {
    throw new Error('Cloudflare Access client ID and secret must be supplied together.');
  }
  if (accessToken && accessClientId) {
    throw new Error('Use either a Cloudflare Access user token or a service token, not both.');
  }

  const headers = {
    accept: 'application/json',
    ...(accessToken ? { 'cf-access-token': accessToken } : accessClientId ? {
      'cf-access-client-id': accessClientId,
      'cf-access-client-secret': accessClientSecret,
    } : {}),
  };
  const latencies = [];
  const failures = [];
  const startedAt = performance.now();

  await Promise.all(Array.from({ length: concurrency }, async (_, workerIndex) => {
    for (let index = workerIndex; index < requests; index += concurrency) {
      const path = paths[index % paths.length];
      const requestStartedAt = performance.now();
      try {
        const response = await fetchImpl(new URL(path, target), {
          headers,
          method: 'GET',
          redirect: 'manual',
        });
        latencies.push(performance.now() - requestStartedAt);
        if (!response.ok) failures.push({ path, status: response.status });
        await response.body?.cancel();
      } catch (error) {
        latencies.push(performance.now() - requestStartedAt);
        failures.push({ path, status: 0, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }));

  const durationMs = performance.now() - startedAt;
  const errorRatePercent = (failures.length / requests) * 100;
  const p95Ms = percentile(latencies, 0.95);
  return {
    baseUrl: target.origin,
    concurrency,
    durationMs: Number(durationMs.toFixed(1)),
    errorRatePercent: Number(errorRatePercent.toFixed(2)),
    errors: failures.length,
    failures: failures.slice(0, 10),
    maxMs: Number(Math.max(...latencies, 0).toFixed(1)),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(1)),
    p95Ms: Number(p95Ms.toFixed(1)),
    passed: p95Ms < maxP95Ms && errorRatePercent < maxErrorRatePercent,
    requests,
    requestsPerSecond: Number((requests / (durationMs / 1000)).toFixed(1)),
  };
}

function parseArguments(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error('Usage: npm run uat:load -- --base-url <https://...> [--concurrency 20-100] [--requests 200]');
    }
    values.set(name, value);
  }
  return values;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const result = await runReadOnlyLoad({
      baseUrl: arguments_.get('--base-url'),
      concurrency: Number(arguments_.get('--concurrency') ?? 20),
      requests: Number(arguments_.get('--requests') ?? 200),
      accessToken: process.env.CF_ACCESS_TOKEN,
      accessClientId: process.env.CF_ACCESS_CLIENT_ID,
      accessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
