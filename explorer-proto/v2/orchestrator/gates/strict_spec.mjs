// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {blocked} from './common.mjs';

import {checkFiles, loadTypeScript} from '../../gates/static_spec_check.mjs';

export default {
    id: 'strict-spec-rules',
    gate: 'lint',
    description: 'The frozen WP-E static spec rules (v2/gates/static_spec_check.mjs) accept the emitted spec.',
    liveOnly: false,

    async run(ctx) {
        if (ctx.specs.length === 0 || !loadTypeScript()) {
            return blocked('environment', [{kind: 'log', ref: '6-emit/commands.json'}]);
        }
        const {status, evidence} = checkFiles(ctx.specs.map((s) => s.abs));
        const refs = ctx.specs.map((s) => ({kind: 'spec', ref: s.rel}));
        if (status === 'pass') {
            return {result: 'pass', evidence: refs, counts: {passed: ctx.specs.length, total: ctx.specs.length}};
        }
        const line = evidence.find((e) => Number.isInteger(e.line))?.line ?? 1;
        return {
            result: 'fail',
            evidence: refs,
            counts: {passed: 0, total: ctx.specs.length},
            failed_at: {file: ctx.specs[0].rel, line},
        };
    },
};
