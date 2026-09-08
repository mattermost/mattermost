// Read the gap straight off the catalogs and write the worklists the translation
// agents consume.
//
//   node build_manifest.mjs <workdir> [repo-root]
//
// Run apply_translations.mjs first. It seeds every en.json key into every catalog
// as "", so by the time this runs a key is untranslated iff its value is the empty
// string -- a property of one locale's catalog, not of the set of catalogs. That is
// what makes a per-locale worklist possible: a locale that already has a string
// does not get asked for it again.
//
// Writes:
//   <workdir>/new_keys.json      union across locales, for the description and
//                                glossary passes that reason about the whole set
//   <workdir>/gaps/<locale>.json that locale's worklist alone, same shape
//
// Both are {"webapp": {"<key>": {"english", "description"}}, "server": {...}}.
// Descriptions come from the i18n-authoring catalogs when present.
import fs from 'fs';
import path from 'path';

const workdir = process.argv[2];
if (!workdir) {
    console.error('usage: node build_manifest.mjs <workdir> [repo-root]');
    process.exit(2);
}

const ROOT = path.resolve(process.argv[3] || '.');
const SURFACES = {
    webapp: {dir: `${ROOT}/webapp/channels/src/i18n`, authoring: `${ROOT}/webapp/channels/src/i18n-authoring/en-with-description.json`, list: false},
    server: {dir: `${ROOT}/server/i18n`, authoring: `${ROOT}/server/i18n-authoring/en-with-description.json`, list: true},
};

// Matches apply_translations.mjs and both checkers: exactly the empty string, not
// whitespace. " " is a real translation in a language that separates where English
// uses a word.
const untranslated = (v) => v === undefined || v === '';

const union = {};
const perLocaleGaps = {};
let extras = 0;

for (const [surface, cfg] of Object.entries(SURFACES)) {
    if (!fs.existsSync(cfg.dir)) {
        console.error(`missing ${cfg.dir} — run from the repository root or pass it as argv[3]`);
        process.exit(2);
    }
    const enRaw = JSON.parse(fs.readFileSync(`${cfg.dir}/en.json`, 'utf8'));
    const en = cfg.list ? new Map(enRaw.map((e) => [e.id, e.translation])) : new Map(Object.entries(enRaw));

    let descriptions = new Map();
    if (fs.existsSync(cfg.authoring)) {
        const a = JSON.parse(fs.readFileSync(cfg.authoring, 'utf8'));
        descriptions = cfg.list ?
            new Map(a.map((e) => [e.id, e.description || ''])) :
            new Map(Object.entries(a).map(([k, v]) => [k, v.description || '']));
    }

    const entry = (k) => ({english: en.get(k), description: descriptions.get(k) || ''});

    const locales = fs.readdirSync(cfg.dir).
        filter((f) => f.endsWith('.json') && f !== 'en.json').
        map((f) => path.basename(f, '.json')).
        sort();

    const missing = new Set();
    const counts = [];
    for (const locale of locales) {
        const raw = JSON.parse(fs.readFileSync(`${cfg.dir}/${locale}.json`, 'utf8'));
        const have = cfg.list ? new Map(raw.map((e) => [e.id, e.translation])) : new Map(Object.entries(raw));

        // en.json order, so a worklist reads in the same order as the catalog.
        const gap = [...en.keys()].filter((k) => untranslated(have.get(k)));
        gap.forEach((k) => missing.add(k));
        counts.push([locale, gap.length]);

        if (gap.length) {
            perLocaleGaps[locale] = perLocaleGaps[locale] || {};
            perLocaleGaps[locale][surface] = Object.fromEntries(gap.map((k) => [k, entry(k)]));
        }

        // Nothing should survive apply_translations.mjs's prune. If something has,
        // this manifest was built against a catalog that never went through it.
        const extra = [...have.keys()].filter((k) => !en.has(k));
        if (extra.length) {
            extras += extra.length;
            console.log(`  ${locale}: ${extra.length} keys not in en.json — run apply_translations.mjs first`);
        }
    }

    union[surface] = Object.fromEntries([...en.keys()].filter((k) => missing.has(k)).map((k) => [k, entry(k)]));

    const total = counts.reduce((a, [, n]) => a + n, 0);
    const undescribed = Object.values(union[surface]).filter((v) => !v.description).length;
    console.log(`${surface}: ${Object.keys(union[surface]).length} distinct keys untranslated in at least one of ${locales.length} locales`);
    console.log(`  total entries to translate: ${total}`);
    if (total) {
        const worst = counts.filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
        console.log(`  ${worst.map(([l, n]) => `${l}:${n}`).join('  ')}`);
    }
    if (undescribed) console.log(`  WARNING: ${undescribed} have no description — run step 1 before translating`);
}

fs.mkdirSync(`${workdir}/gaps`, {recursive: true});
fs.writeFileSync(`${workdir}/new_keys.json`, JSON.stringify(union, null, 2));
for (const [locale, body] of Object.entries(perLocaleGaps)) {
    fs.writeFileSync(`${workdir}/gaps/${locale}.json`, JSON.stringify(body, null, 2));
}

console.log(`\nwrote ${workdir}/new_keys.json`);
console.log(`wrote ${Object.keys(perLocaleGaps).length} per-locale worklists to ${workdir}/gaps/`);
if (extras) console.log(`\n${extras} entries are in a catalog but not en.json; this manifest does not account for them`);
