// Validate one locale's agent output before it touches a catalog.
//
//   node validate_translations.mjs <workdir> <locale> [repo-root]
//
// Reads that locale's worklist -- <workdir>/gaps/<locale>.json, the keys it alone
// is missing -- and the agent's answer in <workdir>/translations/<locale>.json.
// Falls back to the union manifest for a workdir built before per-locale worklists
// existed. Exits non-zero on any error. Warnings are printed but do not fail.
import fs from 'fs';
import path from 'path';
import {createRequire} from 'module';

const [workdir, locale, rootArg] = process.argv.slice(2);
if (!workdir || !locale) {
    console.error('usage: node validate_translations.mjs <workdir> <locale> [repo-root]');
    process.exit(2);
}
const ROOT = path.resolve(rootArg || '.');

// The runtime parser only resolves from inside the webapp workspace; using it
// (rather than a newer copy) is what makes "parses here" mean "parses there".
const {parse} = createRequire(`${ROOT}/webapp/channels/package.json`)('@formatjs/icu-messageformat-parser');

// The per-locale worklist is the authority: a locale that already had a string is
// not asked for it, so requiring the union here would fail every agent that
// correctly returned less than the union.
const gapPath = `${workdir}/gaps/${locale}.json`;
const input = JSON.parse(fs.readFileSync(fs.existsSync(gapPath) ? gapPath : `${workdir}/new_keys.json`, 'utf8'));
const out = JSON.parse(fs.readFileSync(`${workdir}/translations/${locale}.json`, 'utf8'));

const TYPES = {1: 'argument', 2: 'number', 3: 'date', 4: 'time', 5: 'select', 6: 'plural', 8: 'tag'};
function argTypes(ast, m = new Map()) {
    for (const el of ast) {
        if (TYPES[el.type] && el.value !== undefined) {
            if (!m.has(el.value)) m.set(el.value, new Set());
            m.get(el.value).add(TYPES[el.type]);
        }
        if (el.options) for (const o of Object.values(el.options)) argTypes(o.value, m);
        if (el.children) argTypes(el.children, m);
    }
    return m;
}
// Collect the option keys of every plural node in an AST.
function pluralCategories(ast, out = []) {
    for (const el of ast) {
        if (el.type === 6 && el.options) out.push({cats: Object.keys(el.options)});
        if (el.options) for (const o of Object.values(el.options)) pluralCategories(o.value, out);
        if (el.children) pluralCategories(el.children, out);
    }
    return out;
}

const goTokens = (s) => new Set([...String(s).matchAll(/\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1]));
const icuCats = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

const errors = [];
const warnings = [];

for (const surface of ['webapp', 'server']) {
    const want = Object.keys(input[surface] || {});
    const got = out[surface] || {};

    for (const k of want) if (!(k in got)) errors.push(`${surface}:${k}: missing from output`);
    for (const k of Object.keys(got)) if (!want.includes(k)) errors.push(`${surface}:${k}: not in the manifest`);

    for (const [k, v] of Object.entries(got)) {
        if (!want.includes(k)) continue;
        const src = input[surface][k].english;
        if (typeof v !== 'string' || !v.trim()) { errors.push(`${surface}:${k}: empty`); continue; }
        if (v === src) warnings.push(`${surface}:${k}: identical to English`);

        if (surface === 'server') {
            const a = goTokens(src), b = goTokens(v);
            for (const t of b) if (!a.has(t)) errors.push(`${surface}:${k}: invented {{.${t}}}`);
            for (const t of a) if (!b.has(t)) errors.push(`${surface}:${k}: dropped {{.${t}}}`);
            continue;
        }

        let sa, ta;
        try { sa = argTypes(parse(src, {ignoreTag: false, requiresOtherClause: true})); }
        catch { errors.push(`${surface}:${k}: SOURCE does not parse — fix en.json first`); continue; }
        try { ta = argTypes(parse(v, {ignoreTag: false, requiresOtherClause: true})); }
        catch (e) { errors.push(`${surface}:${k}: does not parse: ${String(e.message).split('\n')[0]}`); continue; }

        for (const a of ta.keys()) if (!sa.has(a)) errors.push(`${surface}:${k}: invented variable/tag "${a}"`);
        for (const a of sa.keys()) if (!ta.has(a)) errors.push(`${surface}:${k}: dropped variable/tag "${a}"`);
        for (const [a, ts] of ta) {
            const st = sa.get(a);
            if (st) for (const t of ts) if (!st.has(t)) errors.push(`${surface}:${k}: "${a}" used as ${t}, source uses ${[...st].join('/')}`);
        }

        // A balanced pair in the source is deliberate escaping; only flag a
        // pair the translation introduced on its own.
        if (/'[<{]/.test(v) && !/'[<{]/.test(src)) {
            errors.push(`${surface}:${k}: ASCII apostrophe before ICU syntax opens a quoted literal`);
        }

        // Read plural categories off the AST. A regex cannot do this: the
        // first '}' it meets closes a branch, not the plural.
        for (const {cats} of pluralCategories(parse(v, {ignoreTag: false, requiresOtherClause: true}))) {
            if (!cats.includes('other')) errors.push(`${surface}:${k}: plural has no "other" branch`);
            for (const c of cats) {
                if (c.startsWith('=')) continue; // explicit literal match, always allowed
                if (!icuCats.includes(c)) errors.push(`${surface}:${k}: plural category "${c}" is not used by ${locale}`);
            }
            // ICU silently falls back to `other`, so a missing category is a
            // grammar bug rather than a crash — surface it without failing.
            const absent = icuCats.filter((c) => !cats.includes(c));
            if (absent.length) warnings.push(`${surface}:${k}: plural omits ${absent.join('/')} — ${locale} needs ${icuCats.join('/')}, ICU will fall back to other`);
        }
    }
}

const w = Object.keys(out.webapp || {}).length;
const s = Object.keys(out.server || {}).length;
console.log(`${locale}: ${w} webapp + ${s} server`);
if (warnings.length) {
    console.log(`  warnings (${warnings.length}) — check these are product names, acronyms or pure placeholders:`);
    warnings.slice(0, 10).forEach((x) => console.log(`    ${x}`));
    if (warnings.length > 10) console.log(`    ... and ${warnings.length - 10} more`);
}
if (errors.length) {
    console.error(`  ERRORS (${errors.length}):`);
    errors.slice(0, 25).forEach((x) => console.error(`    ${x}`));
    if (errors.length > 25) console.error(`    ... and ${errors.length - 25} more`);
    process.exit(1);
}
console.log('  errors: none');
