// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {checkProposedCharter} from '../lib/leakage.mjs';

export default {
    id: 'leakage',
    gate: 'leakage',
    description: 'The charter holds no route, ordered step or other session control label (bakeoff leakage rules).',
    liveOnly: false,

    async run(ctx) {
        const result = checkProposedCharter(ctx.charter);
        return {result: result.pass ? 'pass' : 'fail', evidence: [{kind: 'report', ref: ctx.charterFile}]};
    },
};
