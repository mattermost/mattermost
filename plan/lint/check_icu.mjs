// Deterministic ICU lint for Mattermost JS i18n surfaces.
// Layer 1 (runtime guarantee, hard fail):
//   - file parses as JSON, values are strings
//   - key parity: no missing keys, no extra keys vs en.json
//   - every value parses with @formatjs/icu-messageformat-parser (the exact
//     parser react-intl/intl-messageformat uses at runtime)
//   - target variables/tags are a subset of source variables/tags (an unknown
//     variable would throw MISSING_VALUE / render raw at runtime)
// Layer 2 (fidelity, hard fail unless key is in exceptions):
//   - isStructurallySame(source, target): same variables, same types
//   - ASCII apostrophe immediately before "<" or "{" where the source has no
//     escaping at that key (ICU quote silently swallows the rest of the string)
import fs from 'fs';
import {parse, isStructurallySame} from '@formatjs/icu-messageformat-parser';

const [,, enPath, exceptionsPath, ...localePaths] = process.argv;
const exceptions = exceptionsPath && exceptionsPath !== '-' ? new Set(JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'))) : new Set();
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enAst = {};
const errors = [];
for (const [k, v] of Object.entries(en)) {
  try {
    enAst[k] = parse(v, {ignoreTag: false, requiresOtherClause: true});
  } catch (e) {
    errors.push(`en:${k}: source does not parse: ${e.message}`);
  }
}

function collectVars(ast, vars = new Set()) {
  for (const el of ast) {
    if (el.value !== undefined && el.type !== 0) vars.add(el.value);
    if (el.options) for (const o of Object.values(el.options)) collectVars(o.value, vars);
    if (el.children) collectVars(el.children, vars);
  }
  return vars;
}

for (const path of localePaths) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${path}: invalid JSON: ${e.message}`);
    continue;
  }
  const name = path.replace(/^.*\//, '');
  for (const k of Object.keys(en)) {
    if (!(k in data)) errors.push(`${name}:${k}: missing key`);
  }
  for (const [k, v] of Object.entries(data)) {
    if (!(k in en)) { errors.push(`${name}:${k}: extra key not in en.json`); continue; }
    if (typeof v !== 'string') { errors.push(`${name}:${k}: value is not a string`); continue; }
    let ast;
    try {
      ast = parse(v, {ignoreTag: false, requiresOtherClause: true});
    } catch (e) {
      errors.push(`${name}:${k}: does not parse: ${e.message}`);
      continue;
    }
    if (!enAst[k]) continue;
    const enVars = collectVars(enAst[k]);
    for (const varName of collectVars(ast)) {
      if (!enVars.has(varName)) errors.push(`${name}:${k}: unknown variable/tag "${varName}" not present in source`);
    }
    if (!exceptions.has(k)) {
      const r = isStructurallySame(enAst[k], ast);
      if (!r.success) errors.push(`${name}:${k}: structurally different from source: ${r.error.message}`);
      if (/'[<{]/.test(v) && !/'[<{]/.test(en[k])) {
        errors.push(`${name}:${k}: ASCII apostrophe before ICU syntax starts a quote and swallows the rest; use \u2019 or '' instead`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} error(s) across ${localePaths.length} locale file(s)`);
  process.exit(1);
}
console.log(`OK: ${localePaths.length} locale files checked against ${enPath}`);
