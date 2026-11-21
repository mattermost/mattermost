// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {blocked} from './common.mjs';

export default {
    id: 'spec-emitted',
    gate: 'emit',
    description: 'The engine emit command produced a spec for this charter.',
    liveOnly: true,

    async run(ctx) {
        const evidence = [{kind: 'log', ref: '6-emit/commands.json'}];
        const commands = ctx.readOut('6-emit/commands.json');
        if (commands.status !== 'ran') {
            return blocked('environment', evidence);
        }
        return {
            result: ctx.specs.length > 0 ? 'pass' : 'fail',
            evidence: ctx.specs.length ? [{kind: 'spec', ref: ctx.specs[0].rel}] : evidence,
        };
    },
};
