// SPDX-License-Identifier: MIT
/**
 * Minimal static file server for the demo and the browser tests. Serves the
 * repository root so pages can import from /dist and fetch /test/fixtures.
 *
 *   node scripts/serve.mjs [port]      default port 4173
 *
 * Sets the `application/wasm` MIME type that streaming compilation requires,
 * disables caching, and never lists directories (index.html only).
 */
import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? '4173');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.i': 'text/plain; charset=utf-8',
  '.s': 'text/plain; charset=utf-8',
  '.c': 'text/plain; charset=utf-8',
  '.err': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Map a request path onto the repository, refusing anything outside it. */
function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const full = normalize(join(ROOT, decoded));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  const target = resolvePath(req.url ?? '/');
  if (target === null || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(403).end();
    return;
  }
  let path = target;
  try {
    const stat = await fs.stat(path);
    if (stat.isDirectory()) {
      if (!(req.url ?? '').split('?')[0].endsWith('/')) {
        res.writeHead(301, { Location: `${req.url}/` }).end();
        return;
      }
      path = join(path, 'index.html');
      await fs.stat(path);
    }
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(path).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT} at http://127.0.0.1:${String(PORT)}/`);
  console.log(`demo: http://127.0.0.1:${String(PORT)}/demo/`);
});
