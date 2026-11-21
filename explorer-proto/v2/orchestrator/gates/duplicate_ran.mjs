// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import {readJson} from '../lib/common.mjs';
import {validate} from '../lib/schemas.mjs';

export default {
    id: 'duplicate-gate-ran',
    gate: 'duplicate',
    description: 'The coverage duplicate gate ran for this charter, and a needs_review verdict was reviewed.',
    liveOnly: false,

    async run(ctx) {
        const ref = `4-select/coverage/${ctx.slug}.json`;
        const evidence = [{kind: 'report', ref}];
        const abs = path.join(ctx.out, ref);
        const d = ctx.decision;
        if (!fs.existsSync(abs) || !d || d.coverage_verdict === 'not_run') {
            return {result: 'fail', evidence};
        }
        const report = readJson(abs);
        if (!validate('orch#coverage-report', report).ok || report.verdict !== d.coverage_verdict) {
            return {result: 'fail', evidence};
        }
        if (report.verdict === 'likely_duplicate') {
            return {result: 'fail', evidence};
        }
        if (report.verdict === 'needs_review' && !d.reviewed) {
            return {result: 'fail', evidence};
        }
        return {result: 'pass', evidence};
    },
};
