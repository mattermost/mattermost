// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Write an agent's descriptions into en.json, after find_empty_descriptions.mjs
// and before plan_translations.mjs.
//
//   node i18n/scripts/fill_empty_descriptions.mjs <workdir>
//
// Run from the repository root. Reads <workdir>/descriptions.json, each key
// mapped to its description:
//
//   {"webapp": {"<key>": "<description>"}, "server": {"<id>": "<description>"}}
//
// Fills only descriptions that are empty, since a translation run changes
// nothing else in en.json, and writes nothing if any entry is refused. A
// webapp description written in a source message descriptor wins over this one
// at the next extract; this is for keys whose source has none.
import fs from 'fs';
import path from 'path';

import {SOURCE, SURFACES} from './lib/catalogs.mjs';
import {paths} from './lib/workdir.mjs';

const [workdir, ...extra] = process.argv.slice(2);
if (!workdir || extra.length) {
    console.error('usage: node i18n/scripts/fill_empty_descriptions.mjs <workdir>');
    process.exit(2);
}

const input = paths(workdir).descriptions;
let body;
try {
    body = JSON.parse(fs.readFileSync(input, 'utf8'));
} catch (e) {
    console.error(`cannot read ${input}: ${e.message}`);
    process.exit(2);
}

const problems = [];
for (const k of Object.keys(body)) {
    if (!SURFACES[k]) {
        problems.push(`unknown top-level field "${k}"; expected ${Object.keys(SURFACES).join(', ')}`);
    }
}

const writes = [];
for (const [surface, {dir, list}] of Object.entries(SURFACES)) {
    const wanted = body[surface] || {};
    if (!Object.keys(wanted).length) {
        continue;
    }
    const file = path.join(process.cwd(), dir, SOURCE);
    const en = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = list ? new Map(en.map((e) => [e.id, e])) : new Map(Object.entries(en));
    for (const [k, description] of Object.entries(wanted)) {
        const entry = entries.get(k);
        const english = entry && (list ? entry.translation : entry.defaultMessage);
        if (!entry) {
            problems.push(`${surface}:${k}: not in ${dir}/${SOURCE}`);
        } else if (typeof description !== 'string' || !description.trim()) {
            problems.push(`${surface}:${k}: empty`);
        } else if ((entry.description || '').trim()) {
            problems.push(`${surface}:${k}: already described; a run fills only empty descriptions`);
        } else if (description.trim() === (typeof english === 'string' ? english.trim() : '')) {
            problems.push(`${surface}:${k}: restates the English; say where it appears and what its variables are`);
        } else {
            entry.description = description.trim();
        }
    }
    writes.push([file, JSON.stringify(en, null, 2) + '\n', Object.keys(wanted).length]);
}

if (problems.length) {
    console.error(`${problems.join('\n')}\n\nnothing written`);
    process.exit(1);
}
for (const [file, text, n] of writes) {
    fs.writeFileSync(file, text);
    console.log(`${path.relative(process.cwd(), file)}: ${n} description(s)`);
}
