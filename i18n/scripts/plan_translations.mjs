// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Work out what a translation run has to do, and write each locale's worklist.
//
//   node i18n/scripts/plan_translations.mjs <workdir>
//       [--upstream origin/master | --base <rev>]
//
// Run from the repository root. Reads the catalogs, en.json and
// i18n/baseline.json from the working tree, and en.json as of each locale's
// baseline commit from git. Changes nothing in the repository.
//
// The base is the commit the run translates against: by default where HEAD
// leaves --upstream. finalize.mjs records it as the new baseline for every locale
// it brings up to date.
//
// Each worklist also lists the locale's existing translations that break a rule
// the catalogs are being brought up to, as repairs, for the translator to fix
// or to leave as they are.
//
// The worklists carry the glossary as it stands, so run this after the glossary
// pass over find_new_strings.mjs's strings.json.
//
// Planning again, after the repository moved, keeps every answer in
// <workdir>/translations/ whose worklist item is unchanged, and drops the rest,
// so only what changed goes back to a translator.
//
// Exits 1, changing nothing in the workdir, when a worklist key has no
// description. find_empty_descriptions.mjs and fill_empty_descriptions.mjs, run
// first, leave none.
import fs from 'fs';
import path from 'path';
import {parseArgs} from 'util';

import {catalogPath, isBlank, parseCatalog, readSource, SURFACES} from './lib/catalogs.mjs';
import {readGlossary, readStyle, termsIn} from './lib/glossary.mjs';
import {computePlan, counts} from './lib/plan.mjs';
import {commitTrees, isAncestor, mergeBase, revParse, workingTree} from './lib/repo.mjs';
import {isRightToLeft, serverPluralCategories} from './lib/rules.mjs';
import {writeRemaining, writeSlices} from './lib/slices.mjs';
import {answerFiles, digest, paths, PLAN_VERSION, readJSON, writeJSON} from './lib/workdir.mjs';

const usage = 'usage: node i18n/scripts/plan_translations.mjs <workdir> [--upstream <ref> | --base <rev>]';
let options;
try {
    options = parseArgs({
        allowPositionals: true,
        options: {
            upstream: {type: 'string', default: 'origin/master'},
            base: {type: 'string'},
        },
    });
} catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
}
const {upstream, base: baseArg} = options.values;
const [workdir, ...extra] = options.positionals;

if (!workdir || extra.length) {
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
    plan = computePlan({tree, history, base});
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

const c = counts(plan);
const locales = Object.keys(c).sort();
const row = (cells) => console.log(cells.map((cell, i) => (i ? String(cell).padStart(8) : String(cell).padEnd(8))).join(''));
row(['locale', 'new', 'changed', 'repair', 'carried', 'pruned']);
for (const locale of locales) {
    const l = c[locale];
    row([locale, l.new, l.changed, l.repair, l.carry, l.prune]);
}
const total = Object.values(c).reduce((a, l) => a + l.new + l.changed + l.repair, 0);
console.log(`\nbase ${base}`);
console.log(`${total} worklist entries across ${locales.filter((l) => c[l].webapp + c[l].server).length} locales`);

const undescribed = Object.entries(plan.undescribed).flatMap(([surface, keys]) => Object.keys(keys).map((k) => `${surface}:${k}`));
if (undescribed.length) {
    console.error(`\n${undescribed.length} worklist key(s) have no description:\n  ${undescribed.join('\n  ')}\nDescribe them first: node i18n/scripts/find_empty_descriptions.mjs ${workdir}`);
    process.exit(1);
}

const p = paths(workdir);
fs.mkdirSync(workdir, {recursive: true});

// The answers are reconciled against the previous plan before anything is
// removed, so a failure here leaves that plan to reconcile against next time.
const answers = keepAnswers(readPrevious(p.plan), plan);
if (answers.kept || answers.dropped) {
    console.log(`kept ${answers.kept} answer(s) from the last plan, and dropped ${answers.dropped} whose worklist item changed`);
}
fs.rmSync(p.worklists, {recursive: true, force: true});
fs.rmSync(p.remaining, {recursive: true, force: true});
fs.rmSync(p.report, {force: true});
fs.rmSync(p.notes, {force: true});
fs.rmSync(p.pruned, {force: true});
writeJSON(p.plan, {version: PLAN_VERSION, root, upstream: baseArg ? null : upstream, ...plan, digest: digest(tree)});

function readPrevious(file) {
    try {
        const body = readJSON(file);
        return body.version === PLAN_VERSION ? body : null;
    } catch {
        return null;
    }
}

/**
 * Rewrite each answer file to hold only answers whose worklist item is the same
 * in the new plan as in the one it was written against, with their
 * acknowledgements and notes. With no readable previous plan, nothing can be
 * shown to still fit, so every answer goes. A file or field that is not an
 * object is left as it is, for validation to report.
 */
function keepAnswers(before, after) {
    let kept = 0;
    let dropped = 0;
    const itemOf = (from, surface, locale, k) => from?.surfaces[surface]?.locales[locale]?.items[k];
    for (const [locale, files] of Object.entries(answerFiles(p))) {
        for (const file of files) {
            let body;
            try {
                body = readJSON(file);
            } catch {
                continue;
            }
            if (!isObject(body)) {
                continue;
            }
            const keep = new Set();
            let malformed = false;
            for (const surface of Object.keys(SURFACES)) {
                if (surface in body && !isObject(body[surface])) {
                    malformed = true;
                    continue;
                }
                for (const k of Object.keys(body[surface] || {})) {
                    const was = itemOf(before, surface, locale, k);
                    if (was && JSON.stringify(was) === JSON.stringify(itemOf(after, surface, locale, k))) {
                        keep.add(`${surface}:${k}`);
                        kept++;
                    } else {
                        delete body[surface][k];
                        dropped++;
                    }
                }
            }
            const unchanged = (ref) => {
                const [surface, k] = ref.split(/:(.*)/s);
                const was = itemOf(before, surface, locale, k);
                return was && JSON.stringify(was) === JSON.stringify(itemOf(after, surface, locale, k));
            };
            for (const field of ['acknowledge', 'notes']) {
                if (field in body && !isObject(body[field])) {
                    malformed = true;
                    continue;
                }
                for (const ref of Object.keys(body[field] || {})) {
                    // A note can be on an item the file leaves out; it stands
                    // while that item does.
                    if (!keep.has(ref) && !(field === 'notes' && unchanged(ref))) {
                        delete body[field][ref];
                    }
                }
            }
            if (keep.size || malformed || Object.keys(body.notes || {}).length) {
                writeJSON(file, body);
            } else {
                fs.rmSync(file);
            }
        }
    }
    return {kept, dropped};
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Hints for each item, gathered from the locale's own catalog, so a translator
// can match what the product already says without searching for it:
//   terms     glossary entries the English uses, with this locale's target
//   siblings  translations of the nearest keys under the same prefix
function hintsFor(surface, locale, items) {
    const en = readSource(tree, surface);
    const {map} = parseCatalog(tree.read(catalogPath(surface, locale)), surface);
    const glossary = readGlossary(tree, locale);

    const done = [...map].filter(([k, v]) => en.has(k) && !items[k] && !isBlank(v));
    const byPrefix = new Map();
    for (const [k] of done) {
        const parts = k.split('.');
        for (let i = 1; i < parts.length; i++) {
            const prefix = parts.slice(0, i).join('.');
            byPrefix.set(prefix, [...(byPrefix.get(prefix) || []), k]);
        }
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
        const terms = termsIn(glossary, item.english);
        out[k] = {
            ...item,
            ...(terms.length ? {terms} : {}),
            ...(Object.keys(siblings).length ? {siblings} : {}),
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
let slices = 0;
for (const locale of locales) {
    const header = {
        locale,
        base,
        language: {
            direction: isRightToLeft(locale) ? 'rtl' : 'ltr',
            script: new Intl.Locale(locale).maximize().script,
            pluralForms: pluralForms(locale),
            ...addressOf(locale),
        },
    };
    const hinted = {};
    for (const surface of Object.keys(SURFACES)) {
        const items = plan.surfaces[surface].locales[locale]?.items || {};
        if (Object.keys(items).length) {
            hinted[surface] = hintsFor(surface, locale, items);
        }
    }
    if (Object.keys(hinted).length) {
        writeSlices(p.worklistsFor(locale), header, hinted);
        slices += writeRemaining(p, locale, unansweredRefs(locale), answerFiles(p)[locale] || []);
        written++;
    }
}

console.log(`wrote ${written} worklists to ${p.worklists}/, and ${slices} slices of work no answer covers yet to ${p.remaining}/`);

/** The locale's worklist items that no answer file answers. */
function unansweredRefs(locale) {
    const answered = new Set();
    for (const file of answerFiles(p)[locale] || []) {
        let body;
        try {
            body = readJSON(file);
        } catch {
            continue;
        }
        for (const surface of Object.keys(SURFACES)) {
            const answers = body?.[surface];
            if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
                Object.keys(answers).forEach((k) => answered.add(`${surface}:${k}`));
            }
        }
    }
    const refs = new Set();
    for (const surface of Object.keys(SURFACES)) {
        for (const k of Object.keys(plan.surfaces[surface].locales[locale]?.items || {})) {
            if (!answered.has(`${surface}:${k}`)) {
                refs.add(`${surface}:${k}`);
            }
        }
    }
    return refs;
}
