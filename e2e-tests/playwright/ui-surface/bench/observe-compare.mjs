// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gap 4 deliverable: compare lean `observe-actions` against Peter `e2e-observe-actions` over a shared corpus of real
// specs and report where they disagree. Each tool runs with its own repo ESLint config (Peter's rule needs type info,
// so it runs through his flat config's projectService). Writes bench/results/observe-compare.json.

import {readdirSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

import {HERE, PETER_DIR, PW_ROOT} from './lib.mjs';

const CORPUS = process.env.CORPUS ?? 'specs/functional/channels/channel_settings';

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...walk(full));
        } else if (full.endsWith('.spec.ts')) {
            out.push(full);
        }
    }
    return out;
}

async function run(workspace, ruleId) {
    const require = createRequire(join(workspace, 'noop.js'));
    const {ESLint} = await import(pathToFileURL(require.resolve('eslint')).href);
    const eslint = new ESLint({cwd: workspace, errorOnUnmatchedPattern: false});
    const dir = resolve(workspace, CORPUS);
    let files;
    try {
        files = walk(dir);
    } catch {
        return new Map();
    }
    const results = await eslint.lintFiles(files);
    const byFile = new Map();
    for (const r of results) {
        const rel = relative(workspace, r.filePath);
        const count = (r.messages ?? []).filter((m) => m.ruleId === ruleId).length;
        byFile.set(rel, count);
    }
    return byFile;
}

const leanBy = await run(PW_ROOT, 'ui-surface/observe-actions');
const peterBy = await run(PETER_DIR, 'test-surface/e2e-observe-actions');

const files = [...new Set([...leanBy.keys(), ...peterBy.keys()])].sort();
const rows = [];
let leanTotal = 0;
let peterTotal = 0;
let agree = 0;
let disagree = 0;
for (const f of files) {
    const l = leanBy.get(f) ?? 0;
    const p = peterBy.get(f) ?? 0;
    leanTotal += l;
    peterTotal += p;
    if (l === p) {
        agree++;
    } else {
        disagree++;
        rows.push({file: f, lean: l, peter: p});
    }
}

const summary = {corpus: CORPUS, files: files.length, leanTotal, peterTotal, filesAgreeing: agree, filesDisagreeing: disagree, disagreements: rows};
mkdirSync(join(HERE, 'results'), {recursive: true});
writeFileSync(join(HERE, 'results/observe-compare.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
