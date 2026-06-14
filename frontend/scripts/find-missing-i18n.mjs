import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src/i18n/locales');

function flatten(obj, prefix = '', out = {}) {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else out[prefix] = obj;
  return out;
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules') walk(p, files);
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const arFlat = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'ar.json'), 'utf8')));
const enFlat = flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')));

const keyRegex = /t\(\s*['"]([^'"]+)['"]/g;
const used = new Set();
for (const file of walk(path.join(root, 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = keyRegex.exec(text)) !== null) used.add(m[1]);
}

const missingAr = [...used].filter((k) => !k.includes('{{') && arFlat[k] === undefined).sort();
const missingEn = [...used].filter((k) => !k.includes('{{') && enFlat[k] === undefined).sort();

console.log('Used keys:', used.size);
console.log('\nMissing in ar.json:', missingAr.length);
missingAr.forEach((k) => console.log(' ', k));
console.log('\nMissing in en.json:', missingEn.length);
missingEn.forEach((k) => console.log(' ', k));
