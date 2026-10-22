// Work out what a translation run has to do, and write each locale's worklist.
//
//   node i18n/scripts/plan.mjs <workdir> [--upstream origin/master | --base <rev>]
//                              [--accept-unusual]
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

import {SURFACES} from './lib/catalogs.mjs';
import {computePlan, counts} from './lib/plan.mjs';
import {commitTrees, isAncestor, mergeBase, revParse, workingTree} from './lib/repo.mjs';
import {paths, PLAN_VERSION, writeJSON} from './lib/workdir.mjs';

const usage = 'usage: node i18n/scripts/plan.mjs <workdir> [--upstream <ref> | --base <rev>] [--accept-unusual]';
let options;
try {
    options = parseArgs({
        allowPositionals: true,
        options: {
            upstream: {type: 'string', default: 'origin/master'},
            base: {type: 'string'},
            'accept-unusual': {type: 'boolean', default: false},
        },
    });
} catch (e) {
    console.error(`${e.message}\n${usage}`);
    process.exit(2);
}
const {upstream, base: baseArg} = options.values;
const acceptUnusual = options.values['accept-unusual'];
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

const p = paths(workdir);
fs.mkdirSync(workdir, {recursive: true});
fs.rmSync(p.worklists, {recursive: true, force: true});
fs.rmSync(p.undescribed, {force: true});
fs.rmSync(p.plan, {force: true});

const strings = {webapp: {}, server: {}};
for (const [surface, {locales}] of Object.entries(plan.surfaces)) {
    for (const {items} of Object.values(locales)) {
        for (const [k, item] of Object.entries(items)) {
            strings[surface][k] = {english: item.english, description: item.description};
        }
    }
}
writeJSON(p.strings, strings);

const c = counts(plan);
const locales = Object.keys(c).sort();
const row = (cells) => console.log(cells.map((cell, i) => (i ? String(cell).padStart(8) : String(cell).padEnd(8))).join(''));
row(['locale', 'new', 'changed', 'carried', 'pruned']);
for (const locale of locales) {
    const l = c[locale];
    row([locale, l.new, l.changed, l.carry, l.prune]);
}
const total = Object.values(c).reduce((a, l) => a + l.new + l.changed, 0);
console.log(`\nbase ${base}`);
console.log(`${total} worklist entries across ${locales.filter((l) => c[l].webapp + c[l].server).length} locales`);

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
writeJSON(p.plan, {version: PLAN_VERSION, root, upstream: baseArg ? null : upstream, ...plan});

let written = 0;
for (const locale of locales) {
    const body = {locale, base};
    let any = false;
    for (const surface of Object.keys(SURFACES)) {
        const items = plan.surfaces[surface].locales[locale]?.items || {};
        if (Object.keys(items).length) {
            body[surface] = items;
            any = true;
        }
    }
    if (any) {
        writeJSON(p.worklist(locale), body);
        written++;
    }
}

console.log(`wrote ${written} worklists to ${p.worklists}/, and every new or changed string to ${p.strings}`);
