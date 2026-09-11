import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const files = ['index.html', 'privacy.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png'];

fs.rmSync(dist, { recursive: true, force: true });

for (const relative of files) {
  const from = path.join(root, relative);
  const to = path.join(dist, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

// The source app is also served directly by `npm run dev`, where `/sw.js` is
// valid. Published builds can live below an origin path (for example GitHub
// Pages), so make the copied module resolve its worker relative to itself.
const appEntryPath = path.join(dist, 'src', 'app.js');
const appEntrySource = fs.readFileSync(appEntryPath, 'utf8');
const rootWorkerRegistration = "navigator.serviceWorker.register('/sw.js')";
if (!appEntrySource.includes(rootWorkerRegistration)) {
  throw new Error('Expected service worker registration was not found in src/app.js');
}
fs.writeFileSync(
  appEntryPath,
  appEntrySource.replace(rootWorkerRegistration, "navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))")
);

// Stamp the service worker's cache name with a content hash of everything it
// precaches, so each published build gets a fresh cache and stale shells are
// never served after an update.
function listFiles(directory) {
  return fs.readdirSync(directory, { recursive: true })
    .map(entry => entry.toString())
    .filter(entry => fs.statSync(path.join(directory, entry)).isFile())
    .sort();
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const hashed = [...files.filter(name => name !== 'sw.js'), ...listFiles(path.join(dist, 'src')).map(name => `src/${name}`)]
  .map(relative => `${relative}:${fileHash(path.join(dist, relative))}`)
  .join('\n');
const cacheVersion = `board-game-assistant-${crypto.createHash('sha256').update(hashed).digest('hex').slice(0, 16)}`;

const swPath = path.join(dist, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/^const CACHE_NAME = .*$/m, `const CACHE_NAME = '${cacheVersion}';`));

console.log(`Built ${files.length} root files and src/ into dist/ (service worker cache: ${cacheVersion})`);
