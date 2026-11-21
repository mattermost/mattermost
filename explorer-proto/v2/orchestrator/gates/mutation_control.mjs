// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/no-confusing-arrow -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

import {blocked} from './common.mjs';

import {APPLIERS} from '../lib/controls.mjs';
import {engineFor} from '../lib/engine.mjs';
import {infraTarget} from '../lib/stages/stage0_target.mjs';

export default {
    id: 'mutation-control',
    gate: 'control_sensitivity',
    description:
        'Each negative control in the charter, applied by replay only, fails the spec at the named assertion. Blocked controls stay in the denominator and are reported blocked.',
    liveOnly: true,

    async run(ctx) {
        const evidence = [{kind: 'spec', ref: ctx.charterFile}];
        if (!ctx.live || ctx.specs.length === 0) {
            return blocked('environment', evidence);
        }
        const controls = ctx.charter.negative_controls ?? [];
        if (controls.length === 0) {
            return blocked('control_not_applicable', evidence);
        }
        const engine = engineFor(ctx.flags, ctx.charter);
        if (!engine.supported) {
            return blocked('environment', evidence);
        }
        const options = {target: infraTarget(ctx.flags.target), engine};
        const outcomes = controls.map((control) =>
            APPLIERS[control.kind] ? APPLIERS[control.kind](ctx, control, options) : 'blocked',
        );
        const counts = {passed: outcomes.filter((o) => o === 'pass').length, total: controls.length};
        if (outcomes.includes('fail')) {
            return {result: 'fail', evidence, counts};
        }
        if (outcomes.includes('blocked')) {
            return {...blocked('control_not_applicable', evidence), counts};
        }
        return {result: 'pass', evidence, counts};
    },
};
