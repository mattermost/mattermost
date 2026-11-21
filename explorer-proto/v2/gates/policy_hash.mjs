#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Prints sha256 of every gate module, fixture and the promotion policy so the bakeoff freeze can pin them.
// Everything under explorer-proto/v2/gates is hashed except approvals.json (it records approvals of a hash) and
// README.md (documentation). A change after a freeze is detectable with --verify.
//
// CLI: policy_hash.mjs [--text]                       print {files, combined}
//      policy_hash.mjs --verify <pin.json>            exit 1 and list changed/added/removed files on a mismatch
//      policy_hash.mjs --check-approval               exit 1 unless approvals.json approves the current combined hash
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
    GATES_DIR,
    compareStrings,
    isHumanApprover,
    parseArgs,
    printJson,
    readJsonFile,
    runCli,
    sha256,
} from './common.mjs';

const EXCLUDED = new Set(['approvals.json', 'README.md']);

function listFiles(dir, prefix = '') {
    const out = [];
    const entries = fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => compareStrings(a.name, b.name));
    for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            out.push(...listFiles(path.join(dir, entry.name), rel));
        } else if (entry.isFile() && !EXCLUDED.has(rel)) {
            out.push(rel);
        }
    }
    return out;
}

export function hashGates(dir = GATES_DIR) {
    const files = {};
    for (const rel of listFiles(dir)) {
        files[rel] = sha256(fs.readFileSync(path.join(dir, rel)));
    }
    const combined = sha256(
        Object.entries(files)
            .map(([rel, hash]) => `${hash}  ${rel}\n`)
            .join(''),
    );
    return {files, combined};
}

export function diffPins(pinned, actual) {
    const changed = Object.keys(actual.files).filter((f) => f in pinned.files && pinned.files[f] !== actual.files[f]);
    const added = Object.keys(actual.files).filter((f) => !(f in pinned.files));
    const removed = Object.keys(pinned.files).filter((f) => !(f in actual.files));
    return {
        changed,
        added,
        removed,
        identical: changed.length + added.length + removed.length === 0 && pinned.combined === actual.combined,
    };
}

export function checkApproval(approvals, combined) {
    const match = (approvals.approvals ?? []).find(
        (a) => a.combined_sha256 === combined && isHumanApprover(a.approved_by),
    );
    return match ? {approved: true, approved_by: match.approved_by, scope: match.scope ?? null} : {approved: false};
}

async function main() {
    const {values} = parseArgs(process.argv.slice(2), {flags: ['text', 'check-approval'], options: ['verify']});
    const actual = hashGates();
    if (values.verify) {
        const diff = diffPins(readJsonFile(values.verify), actual);
        printJson(diff);
        return diff.identical ? 0 : 1;
    }
    if (values['check-approval']) {
        const approvals = readJsonFile(path.join(GATES_DIR, 'approvals.json'));
        const result = checkApproval(approvals, actual.combined);
        printJson({...result, combined: actual.combined});
        return result.approved ? 0 : 1;
    }
    if (values.text) {
        for (const [rel, hash] of Object.entries(actual.files)) {
            process.stdout.write(`${hash}  ${rel}\n`);
        }
        process.stdout.write(`${actual.combined}  (combined)\n`);
    } else {
        printJson(actual);
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
