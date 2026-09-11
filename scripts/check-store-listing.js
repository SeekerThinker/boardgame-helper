import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LISTING_PATH = 'store-listing.json';
const listing = JSON.parse(fs.readFileSync(LISTING_PATH, 'utf8'));

function charLength(value) {
  return Array.from(value).length;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (value !== value.trim()) {
    throw new Error(`${label} must not have leading or trailing whitespace`);
  }
  return value;
}

function assertMaxChars(value, max, label, min = 1) {
  const length = charLength(requiredString(value, label));
  if (length < min || length > max) {
    throw new Error(`${label} must be ${min}-${max} characters, got ${length}`);
  }
  return length;
}

function safeRepositoryFile(relativePath, label) {
  const value = requiredString(relativePath, label);
  if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    throw new Error(`${label} must stay inside the repository: ${value}`);
  }
  const resolved = path.resolve(ROOT, value);
  const relative = path.relative(ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside the repository: ${value}`);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} does not exist: ${value}`);
  }
  return { value, resolved };
}

function readDescription(relativePath, label) {
  const file = safeRepositoryFile(relativePath, `${label} file`);
  const raw = fs.readFileSync(file.resolved, 'utf8');
  const text = raw.trim();
  if (!text) throw new Error(`${label} must not be empty`);
  if (raw !== `${text}\n` && raw !== text) {
    throw new Error(`${label} must not contain leading/trailing blank lines`);
  }
  return { ...file, text };
}

function assertNoEmbeddedListingMetadata(text, appName, label) {
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  if (firstLine === appName || new RegExp(`^${escapeRegExp(appName)}\\s*[-–—:]\\s*`, 'u').test(firstLine)) {
    throw new Error(`${label} starts with a standalone title; keep name/subtitle in store-listing.json`);
  }
  if (/^\s*(?:Version|版本)\s+\d[0-9A-Za-z.+-]*\s*$/gimu.test(text)) {
    throw new Error(`${label} contains a hard-coded version line; version metadata must not live in marketing copy`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateGooglePlay(locale, config) {
  const prefix = `googlePlay.${locale}`;
  const nameChars = assertMaxChars(config?.name, 30, `${prefix}.name`);
  const shortDescriptionChars = assertMaxChars(config?.shortDescription, 80, `${prefix}.shortDescription`);
  const description = readDescription(config?.fullDescriptionFile, `${prefix}.fullDescription`);
  if (!description.value.startsWith('google-play-assets/')) {
    throw new Error(`${prefix}.fullDescriptionFile must live under google-play-assets/`);
  }
  const fullDescriptionChars = charLength(description.text);
  if (fullDescriptionChars > 4000) {
    throw new Error(`${prefix}.fullDescription exceeds 4000 characters: ${fullDescriptionChars}`);
  }
  assertNoEmbeddedListingMetadata(description.text, config.name, `${prefix}.fullDescription`);
  return { nameChars, shortDescriptionChars, fullDescriptionChars };
}

function validateAppStore(locale, config) {
  const prefix = `appStore.${locale}`;
  const nameChars = assertMaxChars(config?.name, 30, `${prefix}.name`, 2);
  const subtitleChars = assertMaxChars(config?.subtitle, 30, `${prefix}.subtitle`);
  const keywords = requiredString(config?.keywords, `${prefix}.keywords`);
  const keywordsBytes = Buffer.byteLength(keywords, 'utf8');
  if (keywordsBytes > 100) {
    throw new Error(`${prefix}.keywords exceeds 100 UTF-8 bytes: ${keywordsBytes}`);
  }
  const keywordItems = keywords.split(',');
  if (!keywordItems.length || keywordItems.some(item => !item.trim() || item !== item.trim())) {
    throw new Error(`${prefix}.keywords must be comma-separated without empty entries or surrounding spaces`);
  }
  const duplicates = keywordItems.filter((item, index) => keywordItems.indexOf(item) !== index);
  if (duplicates.length) {
    throw new Error(`${prefix}.keywords contains duplicates: ${[...new Set(duplicates)].join(', ')}`);
  }
  const tooShort = keywordItems.filter(item => charLength(item) <= 2);
  if (tooShort.length) {
    throw new Error(`${prefix}.keywords entries must be longer than 2 characters: ${tooShort.join(', ')}`);
  }

  const description = readDescription(config?.descriptionFile, `${prefix}.description`);
  if (!description.value.startsWith('app-store-assets/')) {
    throw new Error(`${prefix}.descriptionFile must live under app-store-assets/`);
  }
  const descriptionChars = charLength(description.text);
  if (descriptionChars > 4000) {
    throw new Error(`${prefix}.description exceeds 4000 characters: ${descriptionChars}`);
  }
  assertNoEmbeddedListingMetadata(description.text, config.name, `${prefix}.description`);
  return { nameChars, subtitleChars, keywordsBytes, keywordCount: keywordItems.length, descriptionChars };
}

for (const platform of ['googlePlay', 'appStore']) {
  if (!listing[platform] || typeof listing[platform] !== 'object') {
    throw new Error(`${LISTING_PATH} is missing ${platform}`);
  }
  for (const locale of ['en', 'zh']) {
    if (!listing[platform][locale] || typeof listing[platform][locale] !== 'object') {
      throw new Error(`${LISTING_PATH} is missing ${platform}.${locale}`);
    }
  }
}

const summary = {
  event: 'store-listing-summary',
  status: 'PASS',
  googlePlay: {
    en: validateGooglePlay('en', listing.googlePlay.en),
    zh: validateGooglePlay('zh', listing.googlePlay.zh)
  },
  appStore: {
    en: validateAppStore('en', listing.appStore.en),
    zh: validateAppStore('zh', listing.appStore.zh)
  },
  privacyFiles: {
    local: safeRepositoryFile(listing.localPrivacyPolicyFile, 'localPrivacyPolicyFile').value,
    storeCopy: safeRepositoryFile(listing.storePrivacyPolicyCopy, 'storePrivacyPolicyCopy').value
  }
};

console.log(JSON.stringify(summary, null, 2));
