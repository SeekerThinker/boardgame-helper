import fs from 'node:fs';

const write = process.argv.includes('--write');
const paths = {
  package: 'package.json',
  androidBuild: 'android/app/build.gradle',
  androidVariables: 'android/variables.gradle',
  androidManifest: 'android/app/src/main/AndroidManifest.xml',
  iosProject: 'ios/App/App.xcodeproj/project.pbxproj',
  iosPrivacy: 'ios/App/App/PrivacyInfo.xcprivacy',
  checklist: 'STORE_RELEASE_CHECKLIST.md'
};

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function oneMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not find ${label}`);
  return match[1];
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer, got ${value}`);
  return number;
}

function uniqueConfigValue(source, pattern, label) {
  const values = [...source.matchAll(pattern)].map(match => match[1]);
  if (values.length !== 2) throw new Error(`Expected 2 ${label} entries, found ${values.length}`);
  const unique = [...new Set(values)];
  if (unique.length !== 1) throw new Error(`${label} must match across Debug/Release, got ${unique.join(', ')}`);
  return unique[0];
}

const packageJson = JSON.parse(read(paths.package));
const version = String(packageJson.version || '').trim();
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json has an invalid version: ${version || '(empty)'}`);
}

const androidBuild = read(paths.androidBuild);
const androidVariables = read(paths.androidVariables);
const androidManifest = read(paths.androidManifest);
const iosProject = read(paths.iosProject);
const iosPrivacy = read(paths.iosPrivacy);
let checklist = read(paths.checklist);

const applicationId = oneMatch(androidBuild, /\bapplicationId\s+"([^"]+)"/, 'Android applicationId');
const androidVersion = oneMatch(androidBuild, /\bversionName\s+"([^"]+)"/, 'Android versionName');
const androidVersionCode = positiveInteger(oneMatch(androidBuild, /\bversionCode\s+(\d+)/, 'Android versionCode'), 'Android versionCode');
const targetSdk = positiveInteger(oneMatch(androidVariables, /\btargetSdkVersion\s*=\s*(\d+)/, 'Android targetSdkVersion'), 'Android targetSdkVersion');
const iosVersion = uniqueConfigValue(iosProject, /\bMARKETING_VERSION\s*=\s*([^;\s]+)\s*;/g, 'iOS MARKETING_VERSION');
const iosBuild = positiveInteger(uniqueConfigValue(iosProject, /\bCURRENT_PROJECT_VERSION\s*=\s*([^;\s]+)\s*;/g, 'iOS CURRENT_PROJECT_VERSION'), 'iOS CURRENT_PROJECT_VERSION');

if (androidVersion !== version) throw new Error(`Android versionName ${androidVersion} does not match package.json ${version}`);
if (iosVersion !== version) throw new Error(`iOS MARKETING_VERSION ${iosVersion} does not match package.json ${version}`);

const permissions = new Set([...androidManifest.matchAll(/<uses-permission\s+android:name="([^"]+)"\s*\/>/g)].map(match => match[1]));
for (const permission of ['android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM']) {
  if (!permissions.has(permission)) throw new Error(`Android manifest is missing required permission ${permission}`);
}
if (permissions.has('android.permission.USE_EXACT_ALARM')) {
  throw new Error('Android manifest must not request USE_EXACT_ALARM; this app uses SCHEDULE_EXACT_ALARM');
}

if (!/<key>NSPrivacyTracking<\/key>\s*<false\s*\/>/s.test(iosPrivacy)) {
  throw new Error('iOS privacy manifest must declare NSPrivacyTracking=false');
}
if (!/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\s*\/>/s.test(iosPrivacy) &&
    !/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array>\s*<\/array>/s.test(iosPrivacy)) {
  throw new Error('iOS privacy manifest must declare an empty NSPrivacyCollectedDataTypes array');
}
if (!/<key>NSPrivacyTrackingDomains<\/key>\s*<array\s*\/>/s.test(iosPrivacy) &&
    !/<key>NSPrivacyTrackingDomains<\/key>\s*<array>\s*<\/array>/s.test(iosPrivacy)) {
  throw new Error('iOS privacy manifest must declare no tracking domains');
}

function syncChecklist(source) {
  let result = source.replace(
    /^- 版本：.*$/m,
    `- 版本：${version}（Android versionCode ${androidVersionCode} / iOS build ${iosBuild}）`
  );
  result = result.replace(/^- 包名：`[^`]+`$/m, `- 包名：\`${applicationId}\``);
  result = result.replace(/^- 目标 SDK：\d+$/m, `- 目标 SDK：${targetSdk}`);
  return result;
}

if (write) {
  const updated = syncChecklist(checklist);
  if (updated !== checklist) {
    fs.writeFileSync(paths.checklist, updated);
    checklist = updated;
    console.log('Release checklist metadata synced from native project settings.');
  } else {
    console.log('Release checklist metadata is already current.');
  }
}

const checklistRelease = checklist.match(/^- 版本：([^（\n]+)（Android versionCode (\d+) \/ iOS build (\d+)）$/m);
if (!checklistRelease) throw new Error('Release checklist is missing the canonical version/build metadata line');
const checklistVersion = checklistRelease[1].trim();
const checklistAndroidCode = Number(checklistRelease[2]);
const checklistIosBuild = Number(checklistRelease[3]);
const checklistPackage = oneMatch(checklist, /^- 包名：`([^`]+)`$/m, 'Google Play package name in release checklist');
const checklistTargetSdk = Number(oneMatch(checklist, /^- 目标 SDK：(\d+)$/m, 'Google Play target SDK in release checklist'));

const mismatches = [];
if (checklistVersion !== version) mismatches.push(`checklist version is ${checklistVersion}, expected ${version}`);
if (checklistAndroidCode !== androidVersionCode) mismatches.push(`checklist Android versionCode is ${checklistAndroidCode}, expected ${androidVersionCode}`);
if (checklistIosBuild !== iosBuild) mismatches.push(`checklist iOS build is ${checklistIosBuild}, expected ${iosBuild}`);
if (checklistPackage !== applicationId) mismatches.push(`checklist package is ${checklistPackage}, expected ${applicationId}`);
if (checklistTargetSdk !== targetSdk) mismatches.push(`checklist target SDK is ${checklistTargetSdk}, expected ${targetSdk}`);
if (!checklist.includes('`SCHEDULE_EXACT_ALARM`')) mismatches.push('checklist does not mention SCHEDULE_EXACT_ALARM');

if (mismatches.length) {
  throw new Error(`Release metadata mismatch: ${mismatches.join('; ')}. Run npm run release:sync.`);
}

console.log(JSON.stringify({
  event: 'release-metadata-summary',
  status: 'PASS',
  version,
  android: {
    applicationId,
    versionCode: androidVersionCode,
    versionName: androidVersion,
    targetSdk,
    notificationsPermission: permissions.has('android.permission.POST_NOTIFICATIONS'),
    exactAlarmPermission: 'SCHEDULE_EXACT_ALARM'
  },
  ios: {
    marketingVersion: iosVersion,
    build: iosBuild,
    tracking: false,
    collectedDataTypes: 0
  },
  checklist: 'synchronized'
}, null, 2));
