// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {validateOutDir} from '../lib/artifacts.mjs';

export default {
    id: 'schema-valid-artifacts',
    gate: 'schema',
    description: 'Every JSON artifact written by stages 0 to 6 validates against its schema.',
    liveOnly: false,

    async run(ctx) {
        const {checked, failures} = validateOutDir(ctx.out, {skipStages: [7, 8, 9]});
        if (failures.length === 0) {
            return {
                result: 'pass',
                evidence: [{kind: 'report', ref: ctx.charterFile}],
                counts: {passed: checked, total: checked},
            };
        }
        return {
            result: 'fail',
            evidence: failures.slice(0, 5).map((f) => ({kind: 'report', ref: f.file.replace(/:[0-9]+$/, '')})),
            counts: {passed: checked - failures.length, total: checked},
        };
    },
};
