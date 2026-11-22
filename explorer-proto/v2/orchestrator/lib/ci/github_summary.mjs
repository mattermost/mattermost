// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// `pilot.mjs summary --run-id <id> [--github]`: the run summary as markdown. --github prints a short form for
// $GITHUB_STEP_SUMMARY. Hashes are shortened; no id, port or origin is in a summary to begin with.
import fs from 'node:fs';
import path from 'node:path';

import {EXIT, readJson} from '../common.mjs';

const short = (hash) => (hash ? hash.slice(0, 12) : 'none');
const ICON = {pass: 'PASS', fail: 'FAIL', blocked: 'BLOCKED', incomplete: 'INCOMPLETE'};

function pendingText(runDir) {
    const run = readJson(path.join(runDir, 'run.json'));
    const stages = ['0-target', '1-baseline', '2-control', 'verify', 'collect'].map((dir) => {
        const file = path.join(runDir, dir, 'stage-record.json');
        return `| ${dir} | ${fs.existsSync(file) ? readJson(file).result : 'not run'} |`;
    });
    return [
        `### Explorer pilot: INCOMPLETE (run ${run.run_id})`,
        '',
        'No summary was written: the run has not reached collection.',
        '',
        '| Stage | Result |',
        '| --- | --- |',
        ...stages,
        '',
    ].join('\n');
}

export function githubMarkdown(s) {
    const d = s.delivery;
    const rows = s.results.map((r) => `| ${r.step} | ${r.status} | ${r.produced_by.split(';')[0]} |`);
    return [
        `### Explorer pilot: ${ICON[s.verdict] ?? s.verdict} (run ${s.run_id})`,
        '',
        `Spec \`${s.spec.path.split('/').at(-1)}\` sha256 \`${short(s.spec.sha256)}\`, unchanged at every stage: **${s.spec.unchanged_at_every_stage ? 'yes' : 'NO'}**. Image digest \`${short(s.image_digest.replace('sha256:', ''))}\`.`,
        `Failing assertion of the verification control (title change, restored): line ${s.assertion.line}.`,
        ...(s.blocker ? ['', `**Blocker:** ${s.blocker}`] : []),
        '',
        '| Step | Status | Produced by |',
        '| --- | --- | --- |',
        ...rows,
        '',
        ...(d
            ? [
                  `Delivery: ${d.mode}; verifier: ${d.verifier_kind}; nonce echo matches: ${d.nonce_echo_matches ? 'yes' : 'no'}; task and trace hashes equal on both sides: ${d.hashes_match ? 'yes' : 'no'}.`,
                  '',
              ]
            : []),
    ].join('\n');
}

export function githubSummary({runDir, github}) {
    const file = path.join(runDir, 'summary.json');
    if (!fs.existsSync(file)) {
        process.stdout.write(`${pendingText(runDir)}\n`);
        return EXIT.OK;
    }
    const summary = readJson(file);
    if (github) {
        process.stdout.write(`${githubMarkdown(summary)}\n`);
    } else {
        process.stdout.write(fs.readFileSync(path.join(runDir, 'summary.md'), 'utf8'));
    }
    return EXIT.OK;
}
