// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {blocked} from './common.mjs';

export default {
    id: 'discovery',
    gate: 'discovery',
    description: 'The engine explore command ran for this charter and exited 0.',
    liveOnly: true,

    async run(ctx) {
        const evidence = [{kind: 'log', ref: '5-discover/commands.json'}];
        const commands = ctx.readOut('5-discover/commands.json');
        if (commands.status !== 'ran') {
            return blocked('environment', evidence);
        }
        const mine = commands.commands.filter((c) => c.charter_id === ctx.charterId);
        const ok = mine.length > 0 && mine.every((c) => c.exit_code === 0);
        return {result: ok ? 'pass' : 'fail', evidence};
    },
};
