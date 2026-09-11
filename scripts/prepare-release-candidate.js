import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8');
}

function oneMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not find ${label}`);
  return match[1];
}

function uniqueConfigValue(source, pattern, label) {
  const values = [...source.matchAll(pattern)].map(match => match[1]);
  const unique = [...new Set(values)];
  if (values.length !== 2 || unique.length !== 1) {
    throw new Error(`Expected matching Debug/Release ${label}, got ${values.join(', ') || '(none)'}`);
  }
  return unique[0];
}

function ensureFile(file, label = file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Missing ${label}: ${file}`);
}

function ensureDir(dir, label = dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Missing ${label}: ${dir}`);
}

function copyFile(source, destination) {
  ensureFile(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDir(source, destination) {
  ensureDir(source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

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

function androidSigningInfo(aab) {
  const env = { ...process.env, LANG: 'C', LC_ALL: 'C' };
  const verify = spawnSync('jarsigner', ['-verify', aab], { encoding: 'utf8', env });
  if (verify.error?.code === 'ENOENT') return { status: 'unknown-no-jarsigner', certificateSha256: null };

  const output = `${verify.stdout || ''}\n${verify.stderr || ''}`;
  if (/jar is unsigned/i.test(output)) return { status: 'unsigned', certificateSha256: null };
  if (!/jar verified\./i.test(output)) {
    return { status: verify.status === 0 ? 'unknown' : 'invalid', certificateSha256: null };
  }

  const certificate = spawnSync('keytool', ['-printcert', '-jarfile', aab], { encoding: 'utf8', env });
  if (certificate.error?.code === 'ENOENT') return { status: 'verified', certificateSha256: null };
  const certificateOutput = `${certificate.stdout || ''}\n${certificate.stderr || ''}`;
  const fingerprint = certificateOutput.match(/SHA256:\s*([0-9A-F:]{64,})/i)?.[1]
    ?.replaceAll(':', '')
    .toLowerCase() || null;

  return { status: 'verified', certificateSha256: fingerprint };
}

const outputDir = resolveFromRoot(argValue('output', 'release-candidate'));
const androidAab = resolveFromRoot(argValue('android-aab', 'android/app/build/outputs/bundle/release/app-release.aab'));
const storeAssetsRoot = resolveFromRoot(argValue('store-assets-dir', '.'));
const webDir = resolveFromRoot(argValue('web-dir', 'dist'));

ensureFile(androidAab, 'Android release AAB');
ensureDir(webDir, 'built Web/PWA directory');

const packageJson = JSON.parse(readUtf8(path.join(root, 'package.json')));
const androidBuild = readUtf8(path.join(root, 'android/app/build.gradle'));
const androidVariables = readUtf8(path.join(root, 'android/variables.gradle'));
const iosProject = readUtf8(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'));

const version = String(packageJson.version);
const applicationId = oneMatch(androidBuild, /\bapplicationId\s+"([^"]+)"/, 'Android applicationId');
const androidVersionCode = Number(oneMatch(androidBuild, /\bversionCode\s+(\d+)/, 'Android versionCode'));
const androidVersionName = oneMatch(androidBuild, /\bversionName\s+"([^"]+)"/, 'Android versionName');
const targetSdk = Number(oneMatch(androidVariables, /\btargetSdkVersion\s*=\s*(\d+)/, 'Android target SDK'));
const iosVersion = uniqueConfigValue(iosProject, /\bMARKETING_VERSION\s*=\s*([^;\s]+)\s*;/g, 'iOS MARKETING_VERSION');
const iosBuild = Number(uniqueConfigValue(iosProject, /\bCURRENT_PROJECT_VERSION\s*=\s*([^;\s]+)\s*;/g, 'iOS CURRENT_PROJECT_VERSION'));

if (version !== androidVersionName || version !== iosVersion) {
  throw new Error(`Version mismatch while assembling release candidate: package=${version}, Android=${androidVersionName}, iOS=${iosVersion}`);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

copyDir(webDir, path.join(outputDir, 'web'));
copyFile(androidAab, path.join(outputDir, 'android/app-release.aab'));

for (const file of [
  'store-listing.json',
  'STORE_RELEASE_CHECKLIST.md',
  'privacy.html',
  'google-play-assets/play-store-description-en.txt',
  'google-play-assets/play-store-description-zh.txt',
  'google-play-assets/privacy-policy.html',
  'google-play-assets/icon-1024.png',
  'app-store-assets/description-en.txt',
  'app-store-assets/description-zh.txt'
]) {
  copyFile(path.join(root, file), path.join(outputDir, 'metadata', file));
}

for (const relative of [
  'google-play-assets/feature-graphic-1024x500.jpg',
  'google-play-assets/screenshots',
  'app-store-assets/screenshots'
]) {
  const source = path.join(storeAssetsRoot, relative);
  const destination = path.join(outputDir, 'store-assets', relative);
  if (fs.statSync(source).isDirectory()) copyDir(source, destination);
  else copyFile(source, destination);
}

const signing = androidSigningInfo(path.join(outputDir, 'android/app-release.aab'));
const manifest = {
  schemaVersion: 1,
  app: {
    name: 'Board Game Assistant',
    version
  },
  source: {
    gitSha: process.env.GITHUB_SHA || null,
    gitRef: process.env.GITHUB_REF_NAME || null
  },
  android: {
    applicationId,
    versionCode: androidVersionCode,
    versionName: androidVersionName,
    targetSdk,
    aab: 'android/app-release.aab',
    signingStatus: signing.status,
    signingCertificateSha256: signing.certificateSha256
  },
  ios: {
    marketingVersion: iosVersion,
    build: iosBuild,
    storeBinaryIncluded: false,
    blocker: 'App Store archive/export requires Apple Developer Team, distribution signing certificate, and provisioning profile.'
  },
  externalStorePrerequisites: {
    privacyPolicyHttpsUrl: 'account-owner-required',
    supportContactOrUrl: 'account-owner-required',
    googlePlayConsoleDeclarations: 'account-owner-required',
    appStoreConnectRecordAndReviewMetadata: 'account-owner-required'
  }
};

fs.writeFileSync(path.join(outputDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const checksumFiles = relativeFiles(outputDir).filter(file => file !== 'SHA256SUMS.txt');
const checksumText = checksumFiles.map(file => `${sha256(path.join(outputDir, file))}  ${file}`).join('\n');
fs.writeFileSync(path.join(outputDir, 'SHA256SUMS.txt'), `${checksumText}\n`);

console.log(JSON.stringify({
  event: 'release-candidate-assembled',
  status: 'PASS',
  version,
  output: path.relative(root, outputDir) || '.',
  fileCount: checksumFiles.length + 1,
  androidSigningStatus: signing.status,
  androidSigningCertificateSha256: signing.certificateSha256,
  iosStoreBinaryIncluded: false
}, null, 2));
