#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Derives deny_labels.json: control labels that belong to OTHER sessions and must not appear in a new charter's prose.
// Sources: allowed_actions of explorer-proto/sessions/*/charter.json and allowed_controls of explorer-proto/scenarios.json.
// Journey charters (action_rules) hold policy patterns, not control labels, so they contribute no entries.
//   node build_deny_list.mjs [--out <file>]     (default: deny_labels.json next to this script; "-" prints to stdout)
import fs from 'node:fs';
import path from 'node:path';

import {BAKEOFF_DIR, canonicalJson, isMain, parseArgs, readJson, REPO_ROOT} from './common.mjs';

const MIN_LENGTH = 4;

export function buildDenyList(repoRoot = REPO_ROOT) {
    const byLabel = new Map();
    const add = (label, role, source) => {
        const key = label.toLowerCase();
        const entry = byLabel.get(key) ?? {label, role, sources: []};
        if (!entry.sources.some((s) => s.kind === source.kind && s.id === source.id)) {
            entry.sources.push(source);
        }
        byLabel.set(key, entry);
    };

    const sessionsDir = path.join(repoRoot, 'explorer-proto/sessions');
    for (const name of fs.readdirSync(sessionsDir).sort()) {
        const file = path.join(sessionsDir, name, 'charter.json');
        if (!fs.existsSync(file)) {
            continue;
        }
        for (const action of readJson(file).allowed_actions ?? []) {
            add(action.name, action.role, {kind: 'session', id: name});
        }
    }
    const scenarios = readJson(path.join(repoRoot, 'explorer-proto/scenarios.json')).scenarios;
    for (const scenario of scenarios) {
        for (const control of scenario.allowed_controls ?? []) {
            add(control.name, control.role, {kind: 'pilot', id: scenario.id});
        }
    }

    const labels = [...byLabel.values()]
        .filter((e) => e.label.length >= MIN_LENGTH)
        .map((e) => ({...e, sources: e.sources.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))}))
        .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return {schema: 'explorer-deny-labels/v1', min_length: MIN_LENGTH, labels};
}

if (isMain(import.meta.url)) {
    const {flags} = parseArgs(process.argv.slice(2));
    const text = canonicalJson(buildDenyList());
    if (flags.out === '-') {
        process.stdout.write(text);
    } else {
        const out = flags.out ?? path.join(BAKEOFF_DIR, 'deny_labels.json');
        fs.writeFileSync(out, text);
        process.stdout.write(`wrote ${path.relative(REPO_ROOT, out)}\n`);
    }
}
