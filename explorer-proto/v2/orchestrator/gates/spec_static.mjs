// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';

import {blocked} from './common.mjs';

import {checkSpecText} from '../lib/spec_check.mjs';

export default {
    id: 'spec-static',
    gate: 'lint',
    description: 'The emitted spec has no fixed sleeps, no soft assertions and no CSS or XPath locators.',
    liveOnly: false,

    async run(ctx) {
        if (ctx.specs.length === 0) {
            return blocked('environment', [{kind: 'log', ref: '6-emit/commands.json'}]);
        }
        let passed = 0;
        let first = null;
        for (const spec of ctx.specs) {
            const issues = checkSpecText(fs.readFileSync(spec.abs, 'utf8'), spec.rel);
            if (issues.length === 0) {
                passed++;
            } else {
                first ??= {file: spec.rel, line: issues[0].line};
            }
        }
        const evidence = ctx.specs.map((s) => ({kind: 'spec', ref: s.rel}));
        const counts = {passed, total: ctx.specs.length};
        return first ? {result: 'fail', evidence, counts, failed_at: first} : {result: 'pass', evidence, counts};
    },
};
