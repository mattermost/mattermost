// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/indent, @stylistic/multiline-ternary, @stylistic/operator-linebreak, @stylistic/wrap-regex -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 6, emit: run the engine's emit for each discovered charter (live only) and keep a copy of the emitted spec.
// Dry mode records the exact commands it would run. Journey mode writes its spec into the repository's Playwright
// specs directory itself; the orchestrator only reads the path the engine prints and copies the file.
import fs from 'node:fs';
import path from 'node:path';

import {plannedCommands, unsupportedNote} from './stage5_discover.mjs';
import {acceptedCharters, dirDigest} from './util.mjs';

import {PROTO_DIR, REPO_ROOT, slug} from '../common.mjs';

function emittedFile(stdout, out) {
    const printed = /->\s+(\S+\.spec\.ts)\s*$/m.exec(stdout)?.[1];
    const candidates = printed
        ? [
              path.resolve(REPO_ROOT, printed),
              path.resolve(PROTO_DIR, printed),
              path.resolve(REPO_ROOT, 'e2e-tests/playwright', printed),
              path.resolve(out, printed),
          ]
        : [];
    return candidates.find((f) => fs.existsSync(f)) ?? null;
}

export default {
    index: 6,
    name: 'emit',
    modes: ['author', 'both'],

    inputs(ctx) {
        return [{discover: dirDigest(ctx, 5)}, {engine: ctx.flags.engineCharter ?? null}];
    },

    async run(ctx) {
        const items = acceptedCharters(ctx);
        const discover = ctx.readJson(5, 'commands.json', 'orch#commands');
        const commands = plannedCommands('emit', items, ctx);
        const base = {schema: 'explorer-commands/v1', stage: 'emit', live: ctx.flags.live};
        if (items.length === 0) {
            ctx.writeJson('commands.json', {...base, status: 'planned', commands: []}, 'orch#commands');
            return {result: 'skipped', reason: 'skipped: no accepted charter'};
        }
        if (!ctx.flags.live) {
            const note = unsupportedNote(ctx, items);
            ctx.writeJson(
                'commands.json',
                {...base, status: 'planned', ...(note ? {reason: note} : {}), commands},
                'orch#commands',
            );
            return {result: 'skipped', reason: 'skipped: not live (commands recorded, none run)'};
        }
        if (discover.status !== 'ran') {
            ctx.writeJson(
                'commands.json',
                {...base, status: 'blocked', reason: 'discover did not run', commands},
                'orch#commands',
            );
            return {result: 'blocked', reason: 'discover did not run'};
        }
        const work = path.join(ctx.out, '.work', '5-discover');
        let failed = null;
        for (const command of commands) {
            const argv = command.argv.map((a) => a.replaceAll('{work}', work));
            const done = ctx.exec(argv, {cwd: REPO_ROOT, capture: true});
            command.exit_code = done.status;
            const out = argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? work;
            const file = done.status === 0 ? emittedFile(done.stdout, out) : null;
            if (done.status !== 0) {
                failed = `engine emit exited ${done.status}`;
                break;
            }
            if (!file) {
                failed = 'engine emit printed no readable spec path';
                break;
            }
            const to = path.join(ctx.dir, 'specs', `${slug(command.charter_id)}.spec.ts`);
            fs.mkdirSync(path.dirname(to), {recursive: true});
            fs.copyFileSync(file, to);
        }
        ctx.writeJson('commands.json', {...base, status: 'ran', commands}, 'orch#commands');
        return failed ? {result: 'fail', reason: failed} : {result: 'pass'};
    },
};
