import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(projectRoot, process.argv[2] || '.');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

function normalizeBasePath(value) {
  let base = String(value || '/').trim() || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base += '/';
  return base.replace(/\/{2,}/g, '/');
}

const basePath = normalizeBasePath(process.env.BASE_PATH);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function isInsideRoot(candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveRequest(url) {
  let pathname;
  try { pathname = decodeURIComponent((url || '/').split('?')[0]); } catch (_) { return null; }
  if (!pathname.startsWith(basePath)) return null;
  const relativePath = pathname.slice(basePath.length);
  const candidate = path.resolve(root, relativePath || 'index.html');
  if (!isInsideRoot(candidate)) return null;
  return candidate;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequest(request.url);
  if (!filePath) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(root, 'index.html'), (fallbackError, fallbackData) => {
        if (fallbackError) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        response.writeHead(200, { 'Content-Type': contentTypes['.html'], 'Cache-Control': 'no-store' });
        response.end(fallbackData);
      });
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Serving ${path.relative(projectRoot, root) || '.'} at http://${host}:${port}${basePath}`);
});
