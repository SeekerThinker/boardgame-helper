import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const javaHome = path.join(root, '.local-jdk', 'Contents', 'Home');
const sdkRoot = path.join(root, '.android-sdk');
const aapt2 = path.join(sdkRoot, 'build-tools', '36.0.0', 'aapt2');

for (const requiredPath of [javaHome, sdkRoot, aapt2]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`Missing local Android build dependency: ${requiredPath}`);
    console.error('Install the local JDK and Android SDK first, or run the documented setup steps in README.md.');
    process.exit(1);
  }
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdkRoot,
  ANDROID_SDK_ROOT: sdkRoot,
  ANDROID_USER_HOME: path.join(root, '.android-user'),
  GRADLE_USER_HOME: path.join(root, '.gradle-home'),
  ORG_GRADLE_PROJECT_android_aapt2FromMavenOverride: aapt2
};

const result = spawnSync('./gradlew', ['assembleDebug', '--no-daemon'], {
  cwd: androidDir,
  env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
