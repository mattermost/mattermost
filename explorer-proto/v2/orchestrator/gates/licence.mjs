// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {blocked} from './common.mjs';

export default {
    id: 'licence',
    gate: 'licence',
    description: 'The live licence check of this run passed. Only PASS or FAIL is recorded, never the licence.',
    liveOnly: true,

    async run(ctx) {
        const evidence = [{kind: 'report', ref: '0-target/target-check.json'}];
        const check = ctx.readOut('0-target/target-check.json');
        if (!ctx.live || check.stack.licence === 'not_run') {
            return blocked('environment', evidence);
        }
        return {result: check.stack.licence === 'PASS' ? 'pass' : 'fail', evidence};
    },
};
