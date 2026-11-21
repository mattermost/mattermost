// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 3, triage: deterministic reproduction counts over the repeated oracle runs, then an agent task that classifies.
// The agent may reject or downgrade a finding; it can never confirm one that reproduced fewer than 2 times.
import fs from 'node:fs';
import path from 'node:path';

import {dirDigest} from './util.mjs';

import {newId} from '../common.mjs';
import {validate} from '../schemas.mjs';

// The oracle library's classes mapped onto the contract vocabulary (schemas/common.schema.json oracleClass).
// The mapping is approximate for the two O-MODAL classes; source_class keeps the original name.
export const CLASS_MAP = {
    'console-error': 'console_error',
    'uncaught-exception': 'uncaught_exception',
    'http-4xx': 'failed_request',
    'http-5xx': 'http_server_error',
    'request-failed': 'failed_request',
    'ws-error': 'failed_request',
    'ws-close': 'failed_request',
    'empty-accessible-name': 'accessible_name_missing',
    'dangling-aria-reference': 'accessible_name_missing',
    'duplicate-landmark': 'accessible_name_missing',
    'dialog-without-name': 'accessible_name_missing',
    'ui-rest-mismatch': 'stale_content',
    'enter-submits-while-disabled': 'dead_control',
    'non-ok-submit-without-feedback': 'unexpected_dialog',
};

const RUN_FILE = /^(.+)\.run([0-9]+)\.jsonl$/;
const WITHHELD = '[evidence withheld: it failed sanitization]';

function safePath(raw) {
    const p = String(raw ?? '').split('?')[0];
    return /^\/[A-Za-z0-9_<>.-]*(?:\/[A-Za-z0-9_<>.-]*)*$/.test(p) && !/\.\./.test(p) && p.length <= 200
        ? p
        : '/<unknown>';
}

function safeEvidence(raw) {
    const text = String(raw ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
    const check = validate('common#evidenceText', text);
    return text && check.ok ? text : WITHHELD;
}

/** Groups finding lines by (class, path, evidence); attempts and reproduced count runs of the same traversal. */
export function groupFindings(files, readFile) {
    const runsByTraversal = new Map();
    const seen = new Map();
    for (const file of files) {
        const m = RUN_FILE.exec(path.basename(file));
        if (!m) {
            continue;
        }
        const [, traversal, run] = m;
        runsByTraversal.set(traversal, new Set([...(runsByTraversal.get(traversal) ?? []), run]));
        for (const line of readFile(file).split('\n')) {
            if (!line.trim()) {
                continue;
            }
            let row;
            try {
                row = JSON.parse(line);
            } catch {
                continue;
            }
            const oracle = CLASS_MAP[row.class];
            if (!oracle) {
                continue;
            }
            const key = [traversal, row.class, row.path, row.evidence].join('\u0000');
            const entry = seen.get(key) ?? {traversal, row, runs: new Set(), firstAction: row.first_action ?? 0};
            entry.runs.add(run);
            entry.firstAction = Math.min(entry.firstAction, row.first_action ?? 0);
            seen.set(key, entry);
        }
    }
    const byId = new Map();
    for (const entry of seen.values()) {
        const {row, traversal} = entry;
        const id = newId('fnd', row.class, row.path, row.evidence);
        const group = {
            finding_id: id,
            oracle: CLASS_MAP[row.class],
            source_class: row.class,
            state_path: safePath(row.path),
            evidence_text: safeEvidence(row.evidence),
            attempts: runsByTraversal.get(traversal).size,
            reproduced: entry.runs.size,
            first_action: Math.max(0, Math.trunc(entry.firstAction)),
        };
        const previous = byId.get(id);
        if (!previous || group.reproduced > previous.reproduced) {
            byId.set(id, group);
        }
    }
    return [...byId.values()].sort((a, b) => (a.finding_id < b.finding_id ? -1 : 1));
}

function checkClassifications(groups) {
    const byId = new Map(groups.map((g) => [g.finding_id, g]));
    return (result) => {
        const errors = [];
        const seen = new Set();
        for (const c of result.classifications) {
            const group = byId.get(c.finding_id);
            if (!group) {
                errors.push(`/classifications: unknown finding ${c.finding_id}`);
                continue;
            }
            if (seen.has(c.finding_id)) {
                errors.push(`/classifications: finding ${c.finding_id} classified twice`);
            }
            seen.add(c.finding_id);
            if (c.status === 'confirmed' && group.reproduced < 2) {
                errors.push(
                    `/classifications: ${c.finding_id} reproduced ${group.reproduced} time(s); confirmed needs 2 (deterministic gate)`,
                );
            }
            if (c.rejection_reason === 'not_reproduced' && group.reproduced === group.attempts) {
                errors.push(
                    `/classifications: ${c.finding_id} reproduced in every attempt; it cannot be rejected as not_reproduced`,
                );
            }
        }
        for (const g of groups) {
            if (!seen.has(g.finding_id)) {
                errors.push(`/classifications: finding ${g.finding_id} is missing`);
            }
        }
        return errors;
    };
}

export default {
    index: 3,
    name: 'triage',
    modes: ['explore', 'both'],

    inputs(ctx) {
        return [{explore: dirDigest(ctx, 2)}];
    },

    async run(ctx) {
        const plan = ctx.readJson(2, 'feature-plan.json', 'orch#feature-plan');
        const files = plan.run_files.map((f) => path.join(ctx.out, f));
        const groups = groupFindings(files, (f) => fs.readFileSync(f, 'utf8'));
        const attempts = groups.reduce((n, g) => Math.max(n, g.attempts), 0);
        const repro = {schema: 'explorer-repro/v1', source: plan.findings_source, attempts, groups};
        ctx.writeJson('repro.json', repro, 'orch#repro');

        const empty = {
            schema: 'explorer-triage-summary/v1',
            source: plan.findings_source,
            attempts,
            classification: 'not_needed',
            findings: [],
        };
        if (groups.length === 0) {
            ctx.writeJson('triage-summary.json', empty, 'orch#triage-summary');
            return plan.findings_source === 'none'
                ? {result: 'skipped', reason: 'skipped: not live (no oracle runs to triage)'}
                : {result: 'pass', reason: 'no findings in the oracle runs'};
        }

        const result = await ctx.agent({
            role: 'finding-triager',
            prompt: 'triage.md',
            inputs: [{path: ctx.stageRel('repro.json'), base: 'out', purpose: 'reproduction counts per finding'}],
            schemaRef: 'agent#triage',
            check: checkClassifications(groups),
        });

        const summary = {...empty, classification: 'agent'};
        const traceId = newId('explore', ctx.feature.id);
        for (const group of groups) {
            const c = result.classifications.find((x) => x.finding_id === group.finding_id);
            const finding = {
                schema: 'explorer-finding/v2',
                id: group.finding_id,
                oracle: group.oracle,
                severity_candidate: c.severity_candidate,
                state_path: group.state_path,
                evidence_text: group.evidence_text,
                reproduction_count: {attempts: group.attempts, reproduced: group.reproduced},
                status: c.status,
                trace_ref: {trace_id: traceId},
            };
            if (c.status === 'rejected') {
                finding.rejection_reason = c.rejection_reason;
            }
            const file = `findings/${group.finding_id}.json`;
            ctx.writeJson(file, finding, 'finding');
            summary.findings.push({
                id: group.finding_id,
                oracle: group.oracle,
                status: c.status,
                reproduced: group.reproduced,
                attempts: group.attempts,
                file: ctx.stageRel(file),
            });
        }
        ctx.writeJson('triage-summary.json', summary, 'orch#triage-summary');
        return {result: 'pass'};
    },
};
