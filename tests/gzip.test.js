import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import express from 'express';
import { gzipStatic } from '../server/gzip-static.js';

const PUBLIC = new URL('../public/', import.meta.url).pathname;
let server;
let port;

before(async () => {
  const app = express();
  app.use(gzipStatic(PUBLIC));
  app.use(express.static(PUBLIC));
  server = createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.close());

function get(path, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('JS modules come gzipped, byte-identical after unzip, and much smaller', async () => {
  const original = readFileSync(`${PUBLIC}js/ui.js`);
  const res = await get('/js/ui.js', { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-encoding'], 'gzip');
  assert.match(res.headers['content-type'], /javascript/);
  assert.equal(res.headers['cache-control'], 'no-cache');
  assert.equal(res.headers.vary, 'Accept-Encoding');
  assert.deepEqual(gunzipSync(res.body), original);
  assert.ok(res.body.length < 16 * 1024, `gzipped ui.js is ${res.body.length} bytes`);
  assert.ok(res.body.length < original.length / 2);
});

test('every text file in public/ is served gzipped under 16 KB', async () => {
  for (const path of ['/', '/index.html', '/js/main.js', '/js/badges.js', '/js/engine/dice-types.js', '/styles/main.css', '/styles/dice.css']) {
    const res = await get(`${path}?v=1`, { 'accept-encoding': 'gzip' });
    assert.equal(res.status, 200, path);
    assert.equal(res.headers['content-encoding'], 'gzip', path);
    assert.ok(res.body.length < 16 * 1024, `${path}: ${res.body.length} bytes`);
  }
});

test('the ETag revalidates to 304, and HEAD has no body', async () => {
  const first = await get('/js/main.js', { 'accept-encoding': 'gzip' });
  const again = await get('/js/main.js', { 'accept-encoding': 'gzip', 'if-none-match': first.headers.etag });
  assert.equal(again.status, 304);
  assert.equal(again.body.length, 0);
  const head = await get('/js/main.js', { 'accept-encoding': 'gzip' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
});

test('clients without gzip, binary files and unknown paths fall through to express.static', async () => {
  const plain = await get('/js/ui.js');
  assert.equal(plain.status, 200);
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.deepEqual(plain.body, readFileSync(`${PUBLIC}js/ui.js`));

  const missing = await get('/js/nope.js', { 'accept-encoding': 'gzip' });
  assert.equal(missing.status, 404);

  const escape = await get('/js/..%2f..%2fserver%2findex.js', { 'accept-encoding': 'gzip' });
  assert.notEqual(escape.status, 200);
});
