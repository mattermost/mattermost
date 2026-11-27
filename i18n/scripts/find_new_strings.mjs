// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// List every English string a run will translate, for the glossary pass that
// comes before planning.
//
//   node i18n/scripts/find_new_strings.mjs <workdir>
//
// Run from the repository root, after fill_empty_descriptions.mjs. Writes
// <workdir>/strings.json, every key that is new or changed in some locale
// since its baseline, with its English and description, and always writes it:
//
//   {"webapp": {"<key>": {"english": "...", "description": "..."}}, "server": {...}}
//
// It also writes them to <workdir>/strings/NN.json, in slices one agent each
// can hold, cut as worklists are, for a glossary pass too big for one agent.
//
// These are the keys plan_translations.mjs will put on the worklists. Glossary
// terms added for them reach the worklists when plan_translations.mjs runs
// next.
import {computePlan, newStrings} from './lib/plan.mjs';
import {commitTrees, workingTree} from './lib/repo.mjs';
import {writeSlices} from './lib/slices.mjs';
import {paths, writeJSON} from './lib/workdir.mjs';

const [workdir, ...extra] = process.argv.slice(2);
if (!workdir || extra.length) {
    console.error('usage: node i18n/scripts/find_new_strings.mjs <workdir>');
    process.exit(2);
}

const root = process.cwd();
let plan;
try {
    plan = computePlan({tree: workingTree(root), history: commitTrees(root), base: null});
} catch (e) {
    console.error(e.message);
    process.exit(2);
}

const strings = newStrings(plan);
const p = paths(workdir);
writeJSON(p.strings, strings);
const slices = writeSlices(p.stringSlices, {}, strings);
console.log(`${Object.keys(strings.webapp).length} webapp and ${Object.keys(strings.server).length} server string(s) to translate: ${p.strings}, and in ${slices} slice(s) in ${p.stringSlices}/`);
