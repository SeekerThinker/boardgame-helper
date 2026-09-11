import fs from 'node:fs';

const write = process.argv.includes('--write');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = String(packageJson.version || '').trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json has an invalid version: ${version || '(empty)'}`);
}

const androidPath = 'android/app/build.gradle';
const iosPath = 'ios/App/App.xcodeproj/project.pbxproj';

function inspectAndroid(source) {
  const match = source.match(/\bversionName\s+"([^"]+)"/);
  if (!match) throw new Error(`Could not find versionName in ${androidPath}`);
  return match[1];
}

function inspectIos(source) {
  const versions = [...source.matchAll(/\bMARKETING_VERSION\s*=\s*([^;\s]+)\s*;/g)].map(match => match[1]);
  if (versions.length !== 2) {
    throw new Error(`Expected 2 MARKETING_VERSION entries in ${iosPath}, found ${versions.length}`);
  }
  return versions;
}

function syncFile(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(path, after);
  return after !== before;
}

if (write) {
  const androidChanged = syncFile(androidPath, source => source.replace(/\bversionName\s+"[^"]+"/, `versionName "${version}"`));
  const iosChanged = syncFile(iosPath, source => source.replace(/\bMARKETING_VERSION\s*=\s*[^;\s]+\s*;/g, `MARKETING_VERSION = ${version};`));
  console.log(`Native versions synced to ${version}${androidChanged || iosChanged ? '.' : ' (already current).'}`);
}

const androidSource = fs.readFileSync(androidPath, 'utf8');
const iosSource = fs.readFileSync(iosPath, 'utf8');
const androidVersion = inspectAndroid(androidSource);
const iosVersions = inspectIos(iosSource);
const mismatches = [];

if (androidVersion !== version) mismatches.push(`Android versionName is ${androidVersion}`);
iosVersions.forEach((iosVersion, index) => {
  if (iosVersion !== version) mismatches.push(`iOS MARKETING_VERSION #${index + 1} is ${iosVersion}`);
});

if (mismatches.length) {
  throw new Error(`Native versions must match package.json (${version}): ${mismatches.join('; ')}. Run npm run version:sync.`);
}

console.log(`Version check passed: package.json, Android, and iOS are ${version}.`);
