// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location, @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 8, promote: a DRY RUN only. It writes the proposed branch name, commit message and pull request body to files.
// This module runs no git command, opens no pull request and pushes nothing; there is no flag that does.
import {dirDigest} from './util.mjs';

import {sha256Json, slug} from '../common.mjs';

const FENCE = '`'.repeat(3);
const PROPOSED_SPEC_DIR = 'e2e-tests/playwright/specs/functional/explorer_pilot';

function describeVerdicts(verdicts) {
    return verdicts.map((v) => `- ${v.charter_id}: ${v.outcome} (overall ${v.overall})`);
}

export default {
    index: 8,
    name: 'promote',
    modes: ['author', 'both'],

    inputs(ctx) {
        return [{verify: dirDigest(ctx, 7)}, {target: dirDigest(ctx, 0)}];
    },

    async run(ctx) {
        const summary = ctx.readJson(7, 'verify-summary.json', 'orch#verify-summary');
        const target = ctx.readJson(0, 'target.json', 'target');
        const passing = summary.verdicts.filter((v) => v.outcome === 'emitted_passing');
        const promotable = passing.length > 0;
        const tag = sha256Json({verdicts: summary.verdicts, sha: target.sha}).slice(0, 8);
        const branch = `explorer/${slug(ctx.feature.id).toLowerCase()}-${target.kind}-${tag}`;
        const reasons = promotable
            ? []
            : summary.verdicts
                  .map((v) => `${v.charter_id}: ${v.outcome}`)
                  .concat(summary.verdicts.length ? [] : ['no charter reached verification']);
        const wouldAdd = passing.map((v) => `${PROPOSED_SPEC_DIR}/${slug(v.charter_id).toLowerCase()}.spec.ts`);

        const subject = promotable
            ? `Add explorer-generated Playwright spec(s) for ${ctx.feature.id}`
            : `No promotable spec for ${ctx.feature.id}`;
        const commit = [
            subject,
            '',
            `Target: ${target.kind} ${target.ref} (${target.sha.slice(0, 12)}).`,
            ...describeVerdicts(summary.verdicts),
            '',
            promotable
                ? 'Proposal only: written by the pilot orchestrator dry run; nothing was committed.'
                : 'Nothing to commit.',
            '',
        ].join('\n');
        const body = [
            '#### Summary',
            `Proposed by the explorer v2 pilot orchestrator (dry run) for feature ${ctx.feature.id} against ${target.kind} ${target.ref}.`,
            '',
            ...describeVerdicts(summary.verdicts),
            '',
            promotable
                ? `Proposed new spec location(s): ${wouldAdd.map((f) => `\`${f}\``).join(', ')}.`
                : 'Nothing is promotable: no verdict is emitted_passing.',
            '',
            '#### Release Note',
            `${FENCE}release-note`,
            'NONE',
            FENCE,
            '',
        ].join('\n');

        ctx.writeText('branch-name.txt', `${branch}\n`);
        ctx.writeText('commit-message.txt', commit);
        ctx.writeText('pr-body.md', body);
        ctx.writeJson(
            'promote.json',
            {
                schema: 'explorer-promote/v1',
                dry_run: true,
                pushed: false,
                pr_opened: false,
                promotable,
                reasons,
                branch,
                files: ['8-promote/branch-name.txt', '8-promote/commit-message.txt', '8-promote/pr-body.md'],
                would_add: wouldAdd,
            },
            'orch#promote',
        );
        return {
            result: 'pass',
            reason: promotable ? 'proposal written (dry run)' : 'proposal written; nothing promotable (dry run)',
        };
    },
};
