// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The files a run keeps in its working directory, outside the repository.
//
//   plan.json               what plan_translations.mjs decided, read back by finalize.mjs
//   worklists/<locale>/NN.json  one locale's work, with hints, in slices a
//                           translator each can hold, from lib/slices.mjs
//   strings.json            every new and changed English string, from
//                           find_new_strings.mjs, for the glossary pass
//   strings/NN.json         the same, in slices one agent each can hold
//   undescribed.json        every key with no description, from
//                           find_empty_descriptions.mjs
//   descriptions.json       an agent's descriptions for them, for
//                           fill_empty_descriptions.mjs
//   translations/<locale>/*.json  a locale's answers, in any number of files
//   remaining/<locale>/NN.json  the worklist items no answer file has yet, in
//                           slices, from validate_locale.mjs, while there are any
//   report.md               what finalize.mjs did, for the pull request
//   pruned.json             the translations finalize.mjs pruned
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {BASELINE, catalogPath, localesOf, SOURCE, SURFACES} from './catalogs.mjs';

export const PLAN_VERSION = 1;

export const paths = (workdir) => ({
    plan: path.join(workdir, 'plan.json'),
    worklists: path.join(workdir, 'worklists'),
    worklistsFor: (locale) => path.join(workdir, 'worklists', locale),
    strings: path.join(workdir, 'strings.json'),
    stringSlices: path.join(workdir, 'strings'),
    undescribed: path.join(workdir, 'undescribed.json'),
    descriptions: path.join(workdir, 'descriptions.json'),
    translations: path.join(workdir, 'translations'),
    translation: (locale) => path.join(workdir, 'translations', locale),
    remaining: path.join(workdir, 'remaining'),
    remainingFor: (locale) => path.join(workdir, 'remaining', locale),
    report: path.join(workdir, 'report.md'),
    pruned: path.join(workdir, 'pruned.json'),
});

export const writeJSON = (file, body) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
};

export const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The locales with an answers directory, and each one's answer files, sorted. */
export function answerFiles(p) {
    if (!fs.existsSync(p.translations)) {
        return {};
    }
    const out = {};
    for (const locale of fs.readdirSync(p.translations).sort()) {
        const dir = p.translation(locale);
        if (fs.statSync(dir).isDirectory()) {
            out[locale] = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f));
        }
    }
    return out;
}

/**
 * A digest of everything a plan was computed from, so finalize.mjs can refuse a
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
