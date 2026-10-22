// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The first step of every translation run: list the keys in either en.json
// whose description is empty, for an agent to describe before planning.
//
//   node i18n/scripts/find_empty_descriptions.mjs <workdir>
//
// Run from the repository root. Always writes <workdir>/undescribed.json, empty
// when there is nothing to describe:
//
//   {"webapp": {"<key>": {"english": "...", "suggested": {...}}}, "server": {...}}
//
// suggested is offered for a key whose English is identical to a key en.json
// had at a baseline and no longer has: probably a rename. Reusing that
// description lets plan_translations.mjs carry the translation over with no
// translator involved, so use it unless the string has moved somewhere it no
// longer fits.
//
// It removes a <workdir>/descriptions.json left from an earlier listing.
//
// The answers go in <workdir>/descriptions.json, for fill_empty_descriptions.mjs.
import fs from 'fs';

import {readBaseline, readSource, stableText, SURFACES} from './lib/catalogs.mjs';
import {commitTree, workingTree} from './lib/repo.mjs';
import {paths, writeJSON} from './lib/workdir.mjs';

const [workdir, ...extra] = process.argv.slice(2);
if (!workdir || extra.length) {
    console.error('usage: node i18n/scripts/find_empty_descriptions.mjs <workdir>');
    process.exit(2);
}

const p = paths(workdir);
const file = p.undescribed;
const root = process.cwd();
const tree = workingTree(root);
const baseline = readBaseline(tree);
const out = {webapp: {}, server: {}};
let total = 0;
for (const surface of Object.keys(SURFACES)) {
    const en = readSource(tree, surface);
    const empty = [...en].filter(([, {description}]) => !description.trim());
    if (!empty.length) {
        continue;
    }

    // The descriptions of keys en.json has dropped since a baseline, by
    // their English, where the English names a single description.
    const dropped = new Map();
    for (const rev of new Set(Object.values(baseline[surface]))) {
        for (const [k, {english, description}] of readSource(commitTree(root, rev), surface)) {
            if (!en.has(k) && description.trim()) {
                const id = stableText(english);
                dropped.set(id, [...(dropped.get(id) || []), {description, from: k}]);
            }
        }
    }

    for (const [k, {english}] of empty) {
        const candidates = dropped.get(stableText(english)) || [];
        const descriptions = new Set(candidates.map((c) => c.description));
        out[surface][k] = descriptions.size === 1 ? {english, suggested: candidates[0]} : {english};
        total++;
    }
}
writeJSON(file, out);

// Answers to an earlier listing; this one is what the describer answers now.
fs.rmSync(p.descriptions, {force: true});
console.log(`${total} key(s) with no description: ${file}`);
