// Check i18n/glossary/ and i18n/style.json, which translation runs read and add
// to, so that a run's additions are checked as strictly as its translations.
//
//   node i18n/scripts/check_glossary.mjs
//
// Run from the repository root. Exits 1 on any problem:
//
//   - every file is canonical JSON: 2-space indent, trailing newline
//   - en.json entries hold definition, partOfSpeech and doNotTranslate, and
//     optionally aliases and commonWord, and nothing else
//   - partOfSpeech is noun, verb, adjective or noun/verb
//   - commonWord appears only on a doNotTranslate term
//   - no form, term or alias, belongs to two terms
//   - there is a <locale>.json for exactly the locales with catalogs, with the
//     same keys as en.json in the same order
//   - each holds a non-empty target, and optionally a note; a doNotTranslate
//     term's target is the term itself
//   - style.json entries are for locales with catalogs, and hold address
//     (formal or informal), use and avoid, and optionally matchCase and
//     skipSentenceStart; no word is in both use and avoid
import {GLOSSARY_DIR, localesOf, STYLE, SURFACES} from './lib/catalogs.mjs';
import {workingTree} from './lib/repo.mjs';

const EN_FIELDS = new Set(['definition', 'partOfSpeech', 'doNotTranslate', 'aliases', 'commonWord']);
const EN_REQUIRED = ['definition', 'partOfSpeech', 'doNotTranslate'];
const PARTS_OF_SPEECH = new Set(['noun', 'verb', 'adjective', 'noun/verb']);
const LOCALE_FIELDS = new Set(['target', 'note']);
const STYLE_FIELDS = new Set(['address', 'use', 'avoid', 'matchCase', 'skipSentenceStart']);

const tree = workingTree(process.cwd());
const problems = [];
const problem = (file, message) => problems.push(`${file}: ${message}`);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextList = (v) => Array.isArray(v) && v.length > 0 && v.every(isText);

function load(file) {
    const text = tree.read(file);
    if (text === null) {
        return null;
    }
    let body;
    try {
        body = JSON.parse(text);
    } catch (e) {
        problem(file, `not JSON: ${e.message}`);
        return null;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        problem(file, 'not a JSON object');
        return null;
    }
    if (JSON.stringify(body, null, 2) + '\n' !== text) {
        problem(file, 'not in canonical form; rewrite it as JSON.stringify(body, null, 2) plus a newline');
    }
    return body;
}

const enFile = `${GLOSSARY_DIR}/en.json`;
const en = load(enFile);
if (!en) {
    console.error(`${enFile} is missing or unreadable`);
    process.exit(1);
}

const owner = new Map();
for (const [term, entry] of Object.entries(en)) {
    const where = `${enFile}: "${term}"`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        problems.push(`${where}: not an object`);
        continue;
    }
    for (const field of Object.keys(entry)) {
        if (!EN_FIELDS.has(field)) {
            problems.push(`${where}: unknown field "${field}"`);
        }
    }
    for (const field of EN_REQUIRED) {
        if (!(field in entry)) {
            problems.push(`${where}: no ${field}`);
        }
    }
    if ('definition' in entry && !isText(entry.definition)) {
        problems.push(`${where}: definition is empty`);
    }
    if ('partOfSpeech' in entry && !PARTS_OF_SPEECH.has(entry.partOfSpeech)) {
        problems.push(`${where}: partOfSpeech is ${JSON.stringify(entry.partOfSpeech)}, not one of ${[...PARTS_OF_SPEECH].join(', ')}`);
    }
    if ('doNotTranslate' in entry && typeof entry.doNotTranslate !== 'boolean') {
        problems.push(`${where}: doNotTranslate is not true or false`);
    }
    if ('commonWord' in entry && entry.commonWord !== true) {
        problems.push(`${where}: commonWord is only ever true; leave it out otherwise`);
    }
    if (entry.commonWord && !entry.doNotTranslate) {
        problems.push(`${where}: commonWord is for doNotTranslate terms only`);
    }
    if ('aliases' in entry && !isTextList(entry.aliases)) {
        problems.push(`${where}: aliases is not a non-empty list of non-empty strings`);
    }
    for (const form of [term, ...(isTextList(entry.aliases) ? entry.aliases : [])]) {
        if (owner.has(form) && owner.get(form) !== term) {
            problems.push(`${where}: "${form}" is also "${owner.get(form)}"`);
        } else if (owner.has(form)) {
            problems.push(`${where}: "${form}" is listed twice`);
        }
        owner.set(form, term);
    }
}

const catalogLocales = new Set(Object.keys(SURFACES).flatMap((surface) => localesOf(tree, surface)));
const glossaryLocales = new Set(tree.list(GLOSSARY_DIR).filter((f) => f.endsWith('.json') && f !== 'en.json').map((f) => f.slice(0, -'.json'.length)));
for (const locale of catalogLocales) {
    if (!glossaryLocales.has(locale)) {
        problem(`${GLOSSARY_DIR}/${locale}.json`, 'missing; every locale with a catalog has one');
    }
}

const terms = Object.keys(en);
for (const locale of [...glossaryLocales].sort()) {
    const file = `${GLOSSARY_DIR}/${locale}.json`;
    if (!catalogLocales.has(locale)) {
        problem(file, 'no catalog has this locale');
    }
    const body = load(file);
    if (!body) {
        continue;
    }
    const keys = Object.keys(body);
    const missing = terms.filter((t) => !(t in body));
    const extra = keys.filter((t) => !(t in en));
    if (missing.length) {
        problem(file, `missing ${missing.map((t) => `"${t}"`).join(', ')}`);
    }
    if (extra.length) {
        problem(file, `not in en.json: ${extra.map((t) => `"${t}"`).join(', ')}`);
    }
    if (!missing.length && !extra.length && keys.join('\n') !== terms.join('\n')) {
        problem(file, 'terms are not in en.json order');
    }
    for (const [term, entry] of Object.entries(body)) {
        const where = `${file}: "${term}"`;
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            problems.push(`${where}: not an object`);
            continue;
        }
        for (const field of Object.keys(entry)) {
            if (!LOCALE_FIELDS.has(field)) {
                problems.push(`${where}: unknown field "${field}"`);
            }
        }
        if (!isText(entry.target)) {
            problems.push(`${where}: no target`);
        } else if (en[term]?.doNotTranslate && entry.target !== term) {
            problems.push(`${where}: a doNotTranslate term's target is the term itself, not "${entry.target}"`);
        }
        if ('note' in entry && !isText(entry.note)) {
            problems.push(`${where}: note is empty; leave it out instead`);
        }
    }
}

const style = load(STYLE) || {};
for (const [locale, entry] of Object.entries(style)) {
    const where = `${STYLE}: ${locale}`;
    if (!catalogLocales.has(locale)) {
        problems.push(`${where}: no catalog has this locale`);
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        problems.push(`${where}: not an object`);
        continue;
    }
    for (const field of Object.keys(entry)) {
        if (!STYLE_FIELDS.has(field)) {
            problems.push(`${where}: unknown field "${field}"`);
        }
    }
    if (entry.address !== 'formal' && entry.address !== 'informal') {
        problems.push(`${where}: address is formal or informal`);
    }
    for (const field of ['use', 'avoid']) {
        if (!isTextList(entry[field])) {
            problems.push(`${where}: ${field} is not a non-empty list of words`);
        }
    }
    for (const field of ['matchCase', 'skipSentenceStart']) {
        if (field in entry && entry[field] !== true) {
            problems.push(`${where}: ${field} is only ever true; leave it out otherwise`);
        }
    }
    if (isTextList(entry.use) && isTextList(entry.avoid)) {
        const fold = (w) => (entry.matchCase ? w : w.toLowerCase());
        const use = new Set(entry.use.map(fold));
        const both = entry.avoid.filter((w) => use.has(fold(w)));
        if (both.length) {
            problems.push(`${where}: ${both.join(', ')} in both use and avoid`);
        }
    }
}

if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} problem(s)`);
    process.exit(1);
}
console.log(`glossary: ${terms.length} terms, ${glossaryLocales.size} locales; style: ${Object.keys(style).length} locales`);
