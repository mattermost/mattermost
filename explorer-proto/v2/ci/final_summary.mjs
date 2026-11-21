#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Renders the job summary from run-facts.json, ci-status.json and provenance.json, and turns the ledger into the
// step's exit code: 0 PASS, 3 BLOCKED, 30 PENDING, 1 anything else (a FAIL or an incomplete run).
//   final_summary.mjs [--github-summary-file <file>] [--pilot-summary <file>] [--root <repo>]
// The licence row shows PASS, FAIL, BLOCKED or NOT RUN and never a value. The coordinator's own summary is included
// only when the leak scan passed.
import fs from 'node:fs';
import path from 'node:path';

import {
    ADVISORY_SENTENCE,
    annotate,
    ciDir,
    EXIT,
    isMain,
    parseArgs,
    readJson,
    REPO_ROOT,
    sha256File,
    STAGES,
} from './lib.mjs';
import {readLedger} from './ci_status.mjs';

function tryJson(file) {
    try {
        return readJson(file);
    } catch {
        return null;
    }
}

export function overallResult(ledger) {
    const results = STAGES.map(([id]) => ledger.stages?.[id]?.result ?? 'NOT RUN');
    for (const [label, test] of [
        ['FAIL', (r) => r === 'FAIL'],
        ['BLOCKED', (r) => r === 'BLOCKED'],
        ['PENDING', (r) => r === 'PENDING'],
        ['INCOMPLETE', (r) => r === 'NOT RUN' || r === 'SKIPPED'],
    ]) {
        if (results.some(test)) {
            return label;
        }
    }
    return 'PASS';
}

export function exitForOverall(overall) {
    return {PASS: EXIT.OK, BLOCKED: EXIT.BLOCKED, PENDING: EXIT.PENDING}[overall] ?? EXIT.FAIL;
}

function cell(text) {
    return String(text ?? '').replace(/\|/g, '\\|');
}

function specHashUnchanged(facts, root) {
    if (!facts?.verify_spec || !facts.verify_spec_sha256_start) {
        return 'unknown';
    }
    try {
        return sha256File(path.join(root, facts.verify_spec)) === facts.verify_spec_sha256_start ? 'yes' : 'NO';
    } catch {
        return 'NO (spec missing)';
    }
}

export function renderSummary({facts, ledger, provenance, pilotSummary, root = REPO_ROOT}) {
    const stage = (id) => ledger.stages?.[id] ?? null;
    const overall = overallResult(ledger);
    const licence = stage('licence')?.result ?? 'NOT RUN';
    const toolchain = facts?.toolchain;
    const rows = [
        ['Target kind', facts?.target_kind],
        ['Target commit', facts?.target_commit && `\`${facts.target_commit}\``],
        ['Image', facts?.image && `\`${facts.image.repository}:${facts.image.tag}\``],
        ['Image digest', facts?.image && `\`${facts.image.digest}\``],
        [
            'Provenance',
            provenance
                ? `${provenance.status}${provenance.live ? `, live ${provenance.live.status}` : ''} (${(provenance.sources ?? []).join(' + ') || 'no source'})`
                : 'NOT RUN',
        ],
        ['Coordinator revision', facts?.coordinator_revision && `\`${facts.coordinator_revision}\``],
        ['Compatible test source revision', facts?.test_source_revision && `\`${facts.test_source_revision}\``],
        ['Playwright', toolchain?.playwright_version],
        [
            'Chromium revision',
            toolchain &&
                `chromium ${toolchain.chromium_revision}, headless shell ${toolchain.chromium_headless_shell_revision}`,
        ],
        ['Licence check', licence],
        ['Verifier delivery mode', facts?.verifier && `${facts.verifier} (deterministic; no model agent is started)`],
        ['Session / control', facts && `${facts.session} / ${facts.control}`],
        ['Run id', facts?.run_id && `\`${facts.run_id}\``],
        ['Spec hash unchanged', specHashUnchanged(facts, root)],
        ['Teardown', stage('teardown')?.result ?? 'NOT RUN'],
    ];
    const lines = [
        '## Exploratory pilot run (advisory)',
        '',
        `**Overall: ${overall}**`,
        '',
        '| Item | Value |',
        '| --- | --- |',
    ];
    for (const [name, value] of rows) {
        lines.push(`| ${name} | ${cell(value ?? 'not recorded')} |`);
    }
    lines.push('', '### Stages', '', '| Stage | Result | Detail |', '| --- | --- | --- |');
    for (const [id, label] of STAGES) {
        const entry = stage(id);
        lines.push(`| ${cell(label)} | ${entry?.result ?? 'NOT RUN'} | ${cell(entry?.detail ?? '')} |`);
    }
    const stopped = STAGES.filter(([id]) => ['BLOCKED', 'PENDING'].includes(stage(id)?.result));
    if (stopped.length > 0) {
        lines.push(
            '',
            ...stopped.map(
                ([id, label]) =>
                    `- ${stage(id).result}: ${label} (${stage(id).detail || 'no detail'}). This is not a pass.`,
            ),
        );
    }
    if (pilotSummary !== undefined) {
        lines.push('', '### Coordinator summary', '');
        lines.push(
            stage('leak-scan')?.result === 'PASS' ? pilotSummary.trimEnd() : 'Withheld: the leak scan did not pass.',
        );
    }
    lines.push('', ADVISORY_SENTENCE, '');
    return lines.join('\n');
}

function main() {
    const {flags} = parseArgs(process.argv.slice(2));
    const root = path.resolve(flags.root || REPO_ROOT);
    const dir = ciDir();
    const ledger = readLedger();
    let pilotSummary;
    if (flags['pilot-summary']) {
        try {
            pilotSummary = fs.readFileSync(path.resolve(flags['pilot-summary']), 'utf8');
        } catch {
            pilotSummary = 'The coordinator summary is unavailable.';
        }
    }
    const text = renderSummary({
        facts: tryJson(path.join(dir, 'run-facts.json')),
        ledger,
        provenance: tryJson(path.join(dir, 'provenance.json')),
        pilotSummary,
        root,
    });
    if (flags['github-summary-file']) {
        fs.appendFileSync(path.resolve(flags['github-summary-file']), `${text}\n`);
    } else {
        process.stdout.write(text);
    }
    const overall = overallResult(ledger);
    if (overall !== 'PASS') {
        annotate('error', 'exploratory result', `${overall}: this run is not a pass (advisory; it gates nothing)`);
    }
    return exitForOverall(overall);
}

if (isMain(import.meta.url)) {
    process.exit(main());
}
