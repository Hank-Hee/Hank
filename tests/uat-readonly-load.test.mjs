import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { runReadOnlyLoad } from '../scripts/run-uat-readonly-load.mjs';

test('runs 20 concurrent read-only requests and reports latency/error gates', async (t) => {
  let active = 0;
  let maximumActive = 0;
  const methods = [];
  const accessTokens = [];
  const server = createServer(async (request, response) => {
    methods.push(request.method);
    accessTokens.push(request.headers['cf-access-token']);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');

  const result = await runReadOnlyLoad({
    baseUrl: `http://127.0.0.1:${address.port}`,
    concurrency: 20,
    accessToken: 'test-user-access-token',
    maxP95Ms: 2_000,
    requests: 40,
    paths: ['/api/v1/companies'],
  });

  assert.equal(result.passed, true);
  assert.equal(result.requests, 40);
  assert.equal(result.errors, 0);
  assert.ok(maximumActive >= 15, `expected real concurrency, saw ${maximumActive}`);
  assert.deepEqual([...new Set(methods)], ['GET']);
  assert.deepEqual([...new Set(accessTokens)], ['test-user-access-token']);
});

test('refuses unencrypted non-loopback targets', async () => {
  await assert.rejects(
    runReadOnlyLoad({ baseUrl: 'http://example.com', concurrency: 20, requests: 20 }),
    /HTTPS/,
  );
});
