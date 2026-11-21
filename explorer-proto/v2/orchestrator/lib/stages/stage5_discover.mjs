// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/dot-location -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 5, discover: run the engine's explore for each accepted charter (live only). Dry mode records the exact
// commands it would run. A charter the engine cannot read (explorer-charter/v2 at this commit) is blocked in a live
// run; --engine-charter session:<name> or journey:<name> runs an existing engine charter instead.
import fs from 'node:fs';
import path from 'node:path';

import {acceptedCharters, dirDigest} from './util.mjs';

import {REPO_ROOT, slug} from '../common.mjs';
import {engineFor, plannedArgv} from '../engine.mjs';

export function plannedCommands(mode, items, ctx) {
    return items.map(({id, charter}) => ({
        charter_id: id,
        purpose: `engine ${mode}`,
        argv: plannedArgv(mode, ctx.flags, charter, mode === 'replay' ? null : `{work}/${slug(id)}`),
    }));
}

/** Dry-mode note: which accepted charters a live run could not hand to the engine, and why. */
export function unsupportedNote(ctx, items) {
    const problems = items
        .map(({id, charter}) => ({id, engine: engineFor(ctx.flags, charter)}))
        .filter((x) => !x.engine.supported)
        .map((x) => `${x.id}: ${x.engine.reason}`);
    return problems.length ? `a live run would be blocked: ${problems.join('; ')}`.slice(0, 400) : undefined;
}

export default {
    index: 5,
    name: 'discover',
    modes: ['author', 'both'],

    inputs(ctx) {
        return [{select: dirDigest(ctx, 4)}, {engine: ctx.flags.engineCharter ?? null}];
    },

    async run(ctx) {
        const items = acceptedCharters(ctx);
        const base = {schema: 'explorer-commands/v1', stage: 'discover', live: ctx.flags.live};
        const commands = plannedCommands('explore', items, ctx);
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

        for (const {id, charter} of items) {
            const engine = engineFor(ctx.flags, charter);
            if (!engine.supported) {
                ctx.writeJson(
                    'commands.json',
                    {...base, status: 'blocked', reason: `${id}: ${engine.reason}`.slice(0, 400), commands},
                    'orch#commands',
                );
                return {result: 'blocked', reason: engine.reason};
            }
        }
        const work = path.join(ctx.out, '.work', ctx.stageDirName);
        fs.mkdirSync(work, {recursive: true});
        let failed = null;
        for (const command of commands) {
            const argv = command.argv.map((a) => a.replaceAll('{work}', work));
            const done = ctx.exec(argv, {cwd: REPO_ROOT});
            command.exit_code = done.status;
            if (done.status !== 0) {
                failed = `engine explore exited ${done.status}`;
                break;
            }
            const out = argv.find((a) => a.startsWith('--out=')).slice('--out='.length);
            for (const evidence of ['trace.json', 'trace.md']) {
                const from = path.join(out, evidence);
                if (fs.existsSync(from)) {
                    const to = path.join(ctx.dir, slug(command.charter_id), evidence);
                    fs.mkdirSync(path.dirname(to), {recursive: true});
                    fs.copyFileSync(from, to);
                }
            }
        }
        ctx.writeJson('commands.json', {...base, status: 'ran', commands}, 'orch#commands');
        return failed ? {result: 'fail', reason: failed} : {result: 'pass'};
    },
};
