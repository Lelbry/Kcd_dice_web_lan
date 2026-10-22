// Serves text files from public/ gzip-compressed. Some Russian networks stall a connection after
// its first ~16 KB, so a 31 KB module may never arrive; gzip brings each one to a few KB.
// Built on node:zlib only, so a deploy needs no `npm install`. Anything this skips (no gzip in
// Accept-Encoding, binary files, unknown paths) falls through to express.static.
import { gzipSync } from 'node:zlib';
import { statSync, readFileSync } from 'node:fs';
import { join, resolve, sep, extname } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

export function gzipStatic(publicDir) {
  const root = resolve(publicDir);
  const cache = new Map(); // file -> { mtimeMs, size, body, etag }

  function load(file) {
    let st;
    try { st = statSync(file); } catch { return null; }
    if (!st.isFile()) return null;
    const hit = cache.get(file);
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit;
    const body = gzipSync(readFileSync(file), { level: 9 });
    const entry = { mtimeMs: st.mtimeMs, size: st.size, body, etag: `W/"gz-${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"` };
    cache.set(file, entry);
    return entry;
  }

  return function gzipStaticMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
    let rel;
    try { rel = decodeURIComponent(req.path); } catch { return next(); }
    if (rel.endsWith('/')) rel += 'index.html';
    const type = TYPES[extname(rel).toLowerCase()];
    if (!type) return next();
    const file = resolve(join(root, rel));
    if (!file.startsWith(root + sep)) return next();
    const entry = load(file);
    if (!entry) return next();

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('ETag', entry.etag);
    if (req.headers['if-none-match'] === entry.etag) {
      res.statusCode = 304;
      return res.end();
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', entry.body.length);
    res.end(req.method === 'HEAD' ? undefined : entry.body);
  };
}
