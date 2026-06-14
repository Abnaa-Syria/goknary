import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { patchVendorLocales } from './fix-locales.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');

function mergeDeep(target, source) {
  for (const k of Object.keys(source)) {
    if (
      source[k] &&
      typeof source[k] === 'object' &&
      !Array.isArray(source[k]) &&
      target[k] &&
      typeof target[k] === 'object' &&
      !Array.isArray(target[k])
    ) {
      mergeDeep(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

/** Parse JSON with duplicate top-level keys merged (last scalar wins, objects deep-merge). */
function parseWithTopLevelMerge(text) {
  const result = {};
  const inner = text.trim().slice(1, -1);
  const sectionRegex = /^  "([^"]+)":\s*/gm;
  const sections = [];
  let match;
  while ((match = sectionRegex.exec(inner)) !== null) {
    sections.push({ key: match[1], start: match.index + match[0].length });
  }
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const end =
      i + 1 < sections.length
        ? sections[i + 1].start - sections[i + 1].key.length - 5
        : inner.length;
    let chunk = inner.slice(sec.start, end).trim();
    if (chunk.endsWith(',')) chunk = chunk.slice(0, -1).trim();
    const val = JSON.parse(chunk);
    if (
      result[sec.key] &&
      typeof val === 'object' &&
      val !== null &&
      typeof result[sec.key] === 'object'
    ) {
      mergeDeep(result[sec.key], val);
    } else {
      result[sec.key] = val;
    }
  }
  return result;
}

function flatten(obj, prefix = '', out = {}) {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = obj;
  }
  return out;
}

function rebuild(template, flat, prefix = '') {
  if (template !== null && typeof template === 'object' && !Array.isArray(template)) {
    const o = {};
    for (const k of Object.keys(template)) {
      const p = prefix ? `${prefix}.${k}` : k;
      o[k] = rebuild(template[k], flat, p);
    }
    return o;
  }
  if (flat[prefix] !== undefined) return flat[prefix];
  return `[MISSING: ${prefix}]`;
}

const ar = JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8'));
const enText = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8');
const enMerged = parseWithTopLevelMerge(enText);
const flat = flatten(enMerged);
const arFlat = flatten(ar);

const missing = Object.keys(arFlat).filter((k) => flat[k] === undefined);
const extra = Object.keys(flat).filter((k) => arFlat[k] === undefined);

console.log('AR keys:', Object.keys(arFlat).length);
console.log('EN merged keys:', Object.keys(flat).length);
console.log('Missing in EN:', missing.length);
if (missing.length) console.log(missing.join('\n'));
console.log('Extra in EN (dropped):', extra.length);
if (extra.length) console.log(extra.join('\n'));

/** English fallbacks for keys absent from the merged (duplicate-heavy) en.json */
const overrides = {
  'common.EGP': 'EGP',
  'vendor.productsPage.bulkImport': 'Bulk Import',
  'vendor.productsPage.syncFailed': 'Failed to sync product inventory.',
  'vendor.productsPage.deleteConfirm':
    'Are you sure you want to delete this product? This action cannot be undone.',
  'vendor.productsPage.removeSuccess': 'Product removed from catalog successfully.',
  'vendor.productsPage.deleteFailed': 'Failed to delete product',
  'vendor.productsPage.invalidJsonArray': 'Data must be a JSON array of product objects',
  'vendor.productsPage.importSuccess': 'Products imported successfully!',
  'vendor.productsPage.importFailed': 'Failed to import product batch',
  'vendor.productsPage.pendingApproval': 'Pending Review & Approval',
  'vendor.productsPage.lowStock': 'Low Stock',
  'vendor.productsPage.bulkImportTitle': 'Bulk Product Import',
  'vendor.productsPage.bulkImportDesc':
    'Upload products in one batch without affecting platform operations. Paste a JSON array matching the catalog structure.',
  'vendor.productsPage.availableCategoryIds':
    'Available Category IDs (copy and paste into JSON file)',
  'vendor.productsPage.jsonPayloadArray': 'JSON Input Payload',
  'vendor.productsPage.loadSampleJson': 'Load Sample JSON',
  'vendor.productsPage.importingBatches': 'Importing batches...',
  'vendor.productsPage.submitImport': 'Confirm Import',
  'vendor.settingsPage.storeAppearanceDesc': 'Your store appearance on GoKnary',
  'vendor.settingsPage.storeLogo': 'Store Logo',
  'vendor.settingsPage.storeLogoHelp': 'Recommended: 512x512px SVG or PNG',
  'vendor.settingsPage.storeBanner': 'Store Banner',
  'vendor.settingsPage.storeBannerHelp': 'Recommended: 1920x400px high-resolution banner',
  'vendor.settingsPage.protectAccountDesc': 'Protect your seller account access',
  'vendor.settingsPage.failedLoadProfile': 'Failed to load store profile',
  'vendor.settingsPage.storeNameRequired': 'Store name is required',
  'vendor.settingsPage.passwordsDoNotMatch': 'New passwords do not match',
  'vendor.settingsPage.credentialsUpdated': 'Security credentials updated',
  'vendor.settingsPage.failedChangePassword': 'Failed to change password',
  'vendor.settingsPage.syncingSettings': 'Syncing store settings...',
  'vendor.payouts.bankAccountLabel': 'Account Number:',
  'vendor.payouts.bankNameLabel': 'Name:',
  'vendor.payouts.accountNumber': 'Account Number / IBAN',
  'vendor.payouts.beneficiaryNameField': 'Beneficiary Full Name',
  'vendor.payouts.accountOwnerPlaceholder': 'Account owner name',
  'vendor.payouts.syncFailed': 'Failed to sync wallet data',
  'vendor.payouts.enterVodafone': 'Please enter Vodafone Cash wallet number',
  'vendor.payouts.enterInstapay': 'Please enter Instapay address (IPA)',
  'vendor.payouts.submitSuccess': 'Payout request submitted successfully!',
  'vendor.payouts.submitFailed': 'Failed to submit payout request',
};

const mergedFlat = { ...flat, ...overrides };
patchVendorLocales(ar.vendor, 'ar');
const synced = rebuild(ar, mergedFlat);
patchVendorLocales(synced.vendor, 'en');
fs.writeFileSync(
  path.join(localesDir, 'ar.json'),
  `${JSON.stringify(ar, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(localesDir, 'en.json'),
  `${JSON.stringify(synced, null, 2)}\n`,
  'utf8'
);

const stillMissing = Object.keys(arFlat).filter((k) => mergedFlat[k] === undefined);
if (stillMissing.length) {
  console.warn('\nWARNING: wrote file but these keys need manual English translations:');
  stillMissing.forEach((k) => console.warn(' -', k));
} else {
  console.log('\nDone: en.json synced to ar.json structure with no missing keys.');
}
