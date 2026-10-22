// Work out what a translation run has to do, and write each locale's worklist.
//
//   node i18n/scripts/plan.mjs <workdir> [--upstream origin/master | --base <rev>]
//                              [--max-repairs 25] [--accept-unusual]
//
// Run from the repository root. Reads the catalogs, en.json and
// i18n/baseline.json from the working tree, and en.json as of each locale's
// baseline commit from git. Changes nothing in the repository.
//
// The base is the commit the run translates against: by default where HEAD
// leaves --upstream.
//
// Exits 1, writing no plan or worklists, when a worklist key has no description
// (they are listed in <workdir>/undescribed.json) or when the gap is unusually
// large.
import fs from 'fs';
import path from 'path';
import {parseArgs} from 'util';

import {catalogPath, isBlank, parseCatalog, readSource, SURFACES} from './lib/catalogs.mjs';
import {readGlossary, readStyle, termsIn} from './lib/glossary.mjs';
import {computePlan, counts} from './lib/plan.mjs';
import {commitTrees, isAncestor, mergeBase, revParse, workingTree} from './lib/repo.mjs';
import {isRightToLeft, serverPluralCategories} from './lib/rules.mjs';
import {paths, PLAN_VERSION, writeJSON} from './lib/workdir.mjs';

const usage = 'usage: node i18n/scripts/plan.mjs <workdir> [--upstream <ref> | --base <rev>] [--max-repairs <n>] [--accept-unusual]';
let options;
try {
    options = parseArgs({
        allowPositionals: true,
        options: {
            upstream: {type: 'string', default: 'origin/master'},
            base: {type: 'string'},
            'max-repairs': {type: 'string', default: '25'},
            'accept-unusual': {type: 'boolean', default: false},
        },
    });
} catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
}
const {upstream, base: baseArg} = options.values;
const acceptUnusual = options.values['accept-unusual'];
const maxRepairs = Number(options.values['max-repairs']);
const [workdir, ...extra] = options.positionals;

if (!workdir || extra.length || !Number.isInteger(maxRepairs) || maxRepairs < 0) {
    console.error(usage);
    process.exit(2);
}

const root = process.cwd();
for (const {dir} of Object.values(SURFACES)) {
    if (!fs.existsSync(path.join(root, dir))) {
        console.error(`no ${dir} here: run from the repository root`);
        process.exit(2);
    }
}

const base = baseArg ? revParse(root, baseArg) : mergeBase(root, 'HEAD', upstream);
if (!base) {
    console.error(baseArg ?
        `cannot resolve --base ${baseArg}` :
        `cannot find where HEAD leaves ${upstream}: fetch it (git fetch origin master), or name the commit with --base`);
    process.exit(2);
}

const tree = workingTree(root);
const history = commitTrees(root);

let plan;
try {
    plan = computePlan({tree, history, base, maxRepairs});
} catch (e) {
    console.error(e.message);
    process.exit(2);
}

// A baseline commit the base does not descend from would compare en.json
// against a history the catalogs never had.
for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
    for (const [locale, {marker}] of Object.entries(locales)) {
        if (marker && !isAncestor(root, marker, base)) {
            console.error(`i18n/baseline.json: ${surface}/${locale} is at ${marker}, which ${base} does not descend from`);
            process.exit(2);
        }
    }
}

const p = paths(workdir);
fs.mkdirSync(workdir, {recursive: true});
fs.rmSync(p.worklists, {recursive: true, force: true});
fs.rmSync(p.undescribed, {force: true});
fs.rmSync(p.plan, {force: true});

const strings = {webapp: {}, server: {}};
for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
    for (const {items} of Object.values(locales)) {
        for (const [k, item] of Object.entries(items)) {
            if (item.kind !== 'repair') {
                strings[surface][k] = {english: item.english, description: item.description};
            }
        }
    }
}
writeJSON(p.strings, strings);

const c = counts(plan);
const locales = Object.keys(c).sort();
const row = (cells) => console.log(cells.map((cell, i) => (i ? String(cell).padStart(8) : String(cell).padEnd(8))).join(''));
row(['locale', 'new', 'changed', 'repair', 'carried', 'pruned']);
for (const locale of locales) {
    const l = c[locale];
    row([locale, l.new, l.changed, `${l.repair}/${l.repairsAvailable}`, l.carry, l.prune]);
}
const total = Object.values(c).reduce((a, l) => a + l.new + l.changed + l.repair, 0);
console.log(`\nbase ${base}`);
console.log(`${total} worklist entries across ${locales.filter((l) => c[l].webapp + c[l].server).length} locales; repair is taken/available, capped at ${maxRepairs} per surface`);

const undescribed = Object.values(plan.undescribed).reduce((a, s) => a + Object.keys(s).length, 0);
if (undescribed) {
    writeJSON(p.undescribed, plan.undescribed);
    console.error(`\n${undescribed} worklist keys have no description. Write them in en.json, then plan again:\n  ${p.undescribed}`);
    process.exit(1);
}
if (plan.unusual.length && !acceptUnusual) {
    console.error(`\nunusual, so no worklists were written:\n  ${plan.unusual.join('\n  ')}\nfind out why before translating; --accept-unusual if it is expected`);
    process.exit(1);
}
writeJSON(p.plan, {version: PLAN_VERSION, root, upstream: baseArg ? null : upstream, ...plan, maxRepairs});

// Hints for each item, gathered from the locale's own catalog, so a translator
// can match what the product already says without searching for it:
//   terms        glossary entries the English uses, with this locale's target
//   siblings     translations of the nearest keys under the same prefix
//   sameEnglish  how this locale already translates the identical English
function hintsFor(surface, locale, items) {
    const en = readSource(tree, surface);
    const {map} = parseCatalog(tree.read(catalogPath(surface, locale)), surface);
    const glossary = readGlossary(tree, locale);

    const done = [...map].filter(([k, v]) => en.has(k) && !items[k] && !isBlank(v));
    const byPrefix = new Map();
    const byEnglish = new Map();
    for (const [k, v] of done) {
        const parts = k.split('.');
        for (let i = 1; i < parts.length; i++) {
            const prefix = parts.slice(0, i).join('.');
            byPrefix.set(prefix, [...(byPrefix.get(prefix) || []), k]);
        }
        const english = JSON.stringify(en.get(k).english);
        byEnglish.set(english, new Set([...(byEnglish.get(english) || []), JSON.stringify(v)]));
    }

    const out = {};
    for (const [k, item] of Object.entries(items)) {
        const siblings = {};
        const parts = k.split('.');
        for (let i = parts.length - 1; i > 0 && Object.keys(siblings).length < 4; i--) {
            for (const s of byPrefix.get(parts.slice(0, i).join('.')) || []) {
                if (Object.keys(siblings).length >= 4) {
                    break;
                }
                if (!(s in siblings)) {
                    siblings[s] = {english: en.get(s).english, translation: map.get(s)};
                }
            }
        }
        const same = [...(byEnglish.get(JSON.stringify(item.english)) || [])].slice(0, 3).map((v) => JSON.parse(v));
        const terms = termsIn(glossary, item.english);
        out[k] = {
            ...item,
            ...(terms.length ? {terms} : {}),
            ...(Object.keys(siblings).length ? {siblings} : {}),
            ...(same.length ? {sameEnglish: same} : {}),
        };
    }
    return out;
}

const COUNTS = Array.from({length: 1001}, (_, n) => n);
function pluralForms(locale) {
    const rule = new Intl.PluralRules(locale);
    const all = rule.resolvedOptions().pluralCategories;
    const required = new Set(COUNTS.map((n) => rule.select(n)));
    return {
        webapp: {required: all.filter((cat) => cat === 'other' || required.has(cat)), optional: all.filter((cat) => cat !== 'other' && !required.has(cat))},
        server: serverPluralCategories(locale),
    };
}

function addressOf(locale) {
    const style = readStyle(tree, locale);
    return style ? {address: {form: style.address, use: style.use, avoid: style.avoid}} : {};
}

let written = 0;
for (const locale of locales) {
    const body = {
        locale,
        base,
        language: {
            direction: isRightToLeft(locale) ? 'rtl' : 'ltr',
            script: new Intl.Locale(locale).maximize().script,
            pluralForms: pluralForms(locale),
            ...addressOf(locale),
        },
    };
    let any = false;
    for (const surface of Object.keys(SURFACES)) {
        const items = plan.surfaces[surface].locales[locale]?.items || {};
        if (Object.keys(items).length) {
            body[surface] = hintsFor(surface, locale, items);
            any = true;
        }
    }
    if (any) {
        writeJSON(p.worklist(locale), body);
        written++;
    }
}

console.log(`wrote ${written} worklists to ${p.worklists}/, and every new or changed string to ${p.strings}`);
