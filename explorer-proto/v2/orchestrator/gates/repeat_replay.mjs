// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {blocked} from './common.mjs';

import {REPO_ROOT} from '../lib/common.mjs';
import {engineArgv, engineFor} from '../lib/engine.mjs';
import {infraTarget} from '../lib/stages/stage0_target.mjs';

const UP = 'explorer-proto/infra/scripts/up.sh';
const DOWN = 'explorer-proto/infra/scripts/down.sh';

export default {
    id: 'repeat-replay',
    gate: 'stability',
    description: 'The emitted spec passes N replays, each from a freshly started and seeded stack (default N = 20).',
    liveOnly: true,

    async run(ctx) {
        const evidence = [{kind: 'log', ref: '6-emit/commands.json'}];
        if (!ctx.live || ctx.specs.length === 0) {
            return blocked('environment', evidence);
        }
        const engine = engineFor(ctx.flags, ctx.charter);
        if (!engine.supported) {
            return blocked('environment', evidence);
        }
        const total = Number(ctx.flags.repeat ?? 20);
        const bookmarks = engine.kind === 'session' && engine.name === 'bookmarks';
        const target = infraTarget(ctx.flags.target);
        let passed = 0;
        for (let i = 0; i < total; i++) {
            const up = ctx.exec([
                'bash',
                path.join(REPO_ROOT, UP),
                `--target=${target}`,
                ...(bookmarks ? ['--session=bookmarks'] : []),
            ]);
            if (i === 0 && up.status !== 0) {
                return blocked('environment', evidence);
            }
            const replay = up.status === 0 ? ctx.exec(engineArgv('replay', engine), {cwd: REPO_ROOT}) : {status: 1};
            ctx.exec(['bash', path.join(REPO_ROOT, DOWN)]);
            if (replay.status === 0) {
                passed++;
            }
        }
        return {result: passed === total ? 'pass' : 'fail', evidence, counts: {passed, total}};
    },
};
