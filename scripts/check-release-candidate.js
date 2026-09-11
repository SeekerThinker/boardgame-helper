import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireAndroidSigned = process.argv.includes('--require-android-signed');
const dirArg = process.argv.find(arg => arg.startsWith('--dir='));
const candidateDir = path.resolve(root, dirArg ? dirArg.slice('--dir='.length) : 'release-candidate');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function relativeFiles(dir) {
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  }
  walk(dir);
  return files.sort();
}

function requireFile(relative) {
  const file = path.join(candidateDir, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Release candidate is missing ${relative}`);
  return file;
}

if (!fs.existsSync(candidateDir) || !fs.statSync(candidateDir).isDirectory()) {
  throw new Error(`Release candidate directory does not exist: ${candidateDir}`);
}

for (const required of [
  'web/index.html',
  'android/app-release.aab',
  'release-manifest.json',
  'SHA256SUMS.txt',
  'metadata/store-listing.json',
  'metadata/STORE_RELEASE_CHECKLIST.md',
  'metadata/privacy.html',
  'metadata/google-play-assets/play-store-description-en.txt',
  'metadata/google-play-assets/play-store-description-zh.txt',
  'metadata/google-play-assets/privacy-policy.html',
  'metadata/google-play-assets/icon-1024.png',
  'metadata/app-store-assets/description-en.txt',
  'metadata/app-store-assets/description-zh.txt',
  'store-assets/google-play-assets/feature-graphic-1024x500.jpg'
]) requireFile(required);

const manifest = JSON.parse(fs.readFileSync(requireFile('release-manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.schemaVersion !== 1) throw new Error(`Unsupported release manifest schemaVersion ${manifest.schemaVersion}`);
if (manifest.app?.version !== packageJson.version) {
  throw new Error(`Release candidate version ${manifest.app?.version} does not match package.json ${packageJson.version}`);
}
if (manifest.android?.aab !== 'android/app-release.aab') throw new Error('Release manifest points to an unexpected Android AAB path');
if (requireAndroidSigned && manifest.android?.signingStatus !== 'verified') {
  throw new Error(`Android release AAB must be signed for a publishable candidate; got ${manifest.android?.signingStatus || 'missing'}`);
}
if (manifest.ios?.storeBinaryIncluded !== false) throw new Error('Current release candidate must explicitly mark the iOS store binary as not included');

const googleScreenshotsDir = path.join(candidateDir, 'store-assets/google-play-assets/screenshots');
const appStoreScreenshotsDir = path.join(candidateDir, 'store-assets/app-store-assets/screenshots');
for (const dir of [googleScreenshotsDir, appStoreScreenshotsDir]) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Missing screenshots directory ${dir}`);
}
const googleScreenshotCount = relativeFiles(googleScreenshotsDir).length;
const appStoreScreenshotCount = relativeFiles(appStoreScreenshotsDir).length;
if (googleScreenshotCount !== 20) throw new Error(`Expected 20 Google Play screenshots, found ${googleScreenshotCount}`);
if (appStoreScreenshotCount !== 20) throw new Error(`Expected 20 App Store screenshots, found ${appStoreScreenshotCount}`);

const checksumLines = fs.readFileSync(requireFile('SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/).filter(Boolean);
const checksums = new Map();
for (const line of checksumLines) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!match) throw new Error(`Malformed SHA256SUMS line: ${line}`);
  if (checksums.has(match[2])) throw new Error(`Duplicate SHA256SUMS entry for ${match[2]}`);
  checksums.set(match[2], match[1]);
}

const payloadFiles = relativeFiles(candidateDir).filter(file => file !== 'SHA256SUMS.txt');
const listedFiles = [...checksums.keys()].sort();
if (JSON.stringify(payloadFiles) !== JSON.stringify(listedFiles)) {
  const missing = payloadFiles.filter(file => !checksums.has(file));
  const extra = listedFiles.filter(file => !payloadFiles.includes(file));
  throw new Error(`SHA256SUMS file set mismatch; missing=[${missing.join(', ')}], extra=[${extra.join(', ')}]`);
}
for (const [relative, expected] of checksums) {
  const actual = sha256(path.join(candidateDir, relative));
  if (actual !== expected) throw new Error(`SHA-256 mismatch for ${relative}: expected ${expected}, got ${actual}`);
}

console.log(JSON.stringify({
  event: 'release-candidate-summary',
  status: 'PASS',
  version: manifest.app.version,
  checksummedFiles: payloadFiles.length,
  googlePlayScreenshots: googleScreenshotCount,
  appStoreScreenshots: appStoreScreenshotCount,
  androidSigningStatus: manifest.android.signingStatus,
  androidPublishable: manifest.android.signingStatus === 'verified',
  iosStoreBinaryIncluded: manifest.ios.storeBinaryIncluded,
  externalStorePrerequisites: manifest.externalStorePrerequisites
}, null, 2));
