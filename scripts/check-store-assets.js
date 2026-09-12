import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screens = ['01-flow', '02-score', '03-table-os', '04-tools', '05-results'];
const locales = ['zh', 'en'];

const screenshotSpecs = [
  { root: 'google-play-assets/screenshots', device: 'google-phone', width: 1080, height: 1920 },
  { root: 'google-play-assets/screenshots', device: 'google-tablet', width: 2560, height: 1440 },
  { root: 'app-store-assets/screenshots', device: 'iphone-6.9', width: 1290, height: 2796 },
  { root: 'app-store-assets/screenshots', device: 'ipad-13', width: 2064, height: 2752 }
];

const featureGraphic = {
  file: 'google-play-assets/feature-graphic-1024x500.jpg',
  width: 1024,
  height: 500
};

function pngSize(buffer, file) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature) || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${file}: invalid PNG header`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer, file) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`${file}: invalid JPEG header`);
  }

  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;

    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (sofMarkers.has(marker)) {
      if (length < 7) break;
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  throw new Error(`${file}: JPEG dimensions not found`);
}

function readAsset(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) throw new Error(`${relative}: missing`);
  return fs.readFileSync(absolute);
}

function assertDimensions(relative, expectedWidth, expectedHeight) {
  const buffer = readAsset(relative);
  const size = relative.endsWith('.png') ? pngSize(buffer, relative) : jpegSize(buffer, relative);
  if (size.width !== expectedWidth || size.height !== expectedHeight) {
    throw new Error(`${relative}: expected ${expectedWidth}x${expectedHeight}, got ${size.width}x${size.height}`);
  }
}

function assertExactScreenshotSet(directory, expectedNames) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) throw new Error(`${directory}: missing directory`);
  const actual = fs.readdirSync(absolute).filter(name => name.endsWith('.png')).sort();
  const expected = [...expectedNames].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter(name => !actual.includes(name));
    const unexpected = actual.filter(name => !expected.includes(name));
    throw new Error(`${directory}: screenshot set mismatch; missing=[${missing.join(', ')}], unexpected=[${unexpected.join(', ')}]`);
  }
}

function assertDistinctDeviceScreenshots(locale, spec) {
  const seen = new Map();
  for (const screen of screens) {
    const relative = `${spec.root}/${locale}/${spec.device}-${screen}.png`;
    const hash = crypto.createHash('sha256').update(readAsset(relative)).digest('hex');
    const previous = seen.get(hash);
    if (previous) {
      throw new Error(`${spec.device}/${locale}: duplicate screenshots ${previous} and ${screen}`);
    }
    seen.set(hash, screen);
  }
}

let screenshotCount = 0;
for (const locale of locales) {
  for (const storeRoot of ['google-play-assets/screenshots', 'app-store-assets/screenshots']) {
    const relevantSpecs = screenshotSpecs.filter(spec => spec.root === storeRoot);
    const expectedNames = relevantSpecs.flatMap(spec => screens.map(screen => `${spec.device}-${screen}.png`));
    assertExactScreenshotSet(`${storeRoot}/${locale}`, expectedNames);
  }

  for (const spec of screenshotSpecs) {
    for (const screen of screens) {
      const relative = `${spec.root}/${locale}/${spec.device}-${screen}.png`;
      assertDimensions(relative, spec.width, spec.height);
      screenshotCount += 1;
    }
    assertDistinctDeviceScreenshots(locale, spec);
  }
}

assertDimensions(featureGraphic.file, featureGraphic.width, featureGraphic.height);

console.log(JSON.stringify({
  event: 'store-assets-summary',
  status: 'PASS',
  screenshots: screenshotCount,
  featureGraphics: 1,
  totalImages: screenshotCount + 1,
  checks: [
    'exact screenshot filenames',
    'expected screenshot dimensions',
    'no duplicate screenshots per device and locale',
    'Google Play feature graphic dimensions'
  ]
}, null, 2));
