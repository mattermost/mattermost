// The files a run keeps in its working directory, outside the repository.
//
//   plan.json               what plan.mjs decided, read back by apply.mjs
//   worklists/<locale>.json one locale's work, with hints, for its translator
//   strings.json            every new and changed English string, for the
//                           description and glossary passes
//   undescribed.json        worklist keys with no description, when there are any
//   translations/<locale>.json  each translator's answer
//   report.md               what apply.mjs did, for the pull request
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {BASELINE, catalogPath, localesOf, SOURCE, SURFACES} from './catalogs.mjs';

export const PLAN_VERSION = 1;

export const paths = (workdir) => ({
    plan: path.join(workdir, 'plan.json'),
    worklists: path.join(workdir, 'worklists'),
    worklist: (locale) => path.join(workdir, 'worklists', `${locale}.json`),
    strings: path.join(workdir, 'strings.json'),
    undescribed: path.join(workdir, 'undescribed.json'),
    translations: path.join(workdir, 'translations'),
    translation: (locale) => path.join(workdir, 'translations', `${locale}.json`),
    report: path.join(workdir, 'report.md'),
    pruned: path.join(workdir, 'pruned.json'),
});

export const writeJSON = (file, body) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
};

export const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * A digest of everything a plan was computed from, so apply.mjs can refuse a
 * plan the repository has since moved away from.
 */
export function digest(tree) {
    const hash = crypto.createHash('sha256');
    const files = [BASELINE];
    for (const [surface, {dir}] of Object.entries(SURFACES)) {
        files.push(`${dir}/${SOURCE}`, ...localesOf(tree, surface).map((locale) => catalogPath(surface, locale)));
    }
    for (const file of files) {
        hash.update(`${file}\0${tree.read(file) ?? ''}\0`);
    }
    return hash.digest('hex');
}
