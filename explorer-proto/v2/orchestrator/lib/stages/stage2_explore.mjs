// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @stylistic/multiline-ternary, @stylistic/operator-linebreak, no-process-env -- Prettier owns formatting and the repo config relaxes these rules for .ts/.js only */

// Stage 2, explore: run the oracle runner over the feature's bounded traversal definition (live only), or adopt the
// finding files of an earlier run with --oracle-results. Dry mode records "skipped: not live" and the exact command.
import fs from 'node:fs';
import path from 'node:path';

import {dirDigest} from './util.mjs';

import {splitCommand} from '../agents.mjs';
import {hashFiles, listFiles, ORCH_REPO_PATH, REPO_ROOT, sha256File, sha256Json} from '../common.mjs';
import {featureFile} from '../feature.mjs';

const RUN_FILE = /^(.+)\.run([0-9]+)\.jsonl$/;
const EXCLUDED_DIRS = new Set(['faults', 'clean-without-browser-flag', 'runs']);

function defaultRunner(repeat) {
    return ['node', 'explorer-proto/v2/oracles/measure.mjs', '--out={work}', `--repeat=${repeat}`, '--skip-bookmarks'];
}

/** Finding files named <traversal>.run<N>.jsonl below dir, never from fault-injection or flag-variant output. */
export function collectRunFiles(dir) {
    return listFiles(dir, {
        skip: (rel, entry) => entry.isDirectory() && EXCLUDED_DIRS.has(entry.name),
    }).filter((f) => RUN_FILE.test(path.basename(f)));
}

function oracleResultsDigest(dir) {
    return dir && fs.existsSync(dir) ? sha256Json(hashFiles(dir, collectRunFiles(dir))) : null;
}

export default {
    index: 2,
    name: 'explore',
    modes: ['explore', 'both'],

    inputs(ctx) {
        return [
            {feature: sha256File(featureFile(ctx.flags.feature))},
            {target: dirDigest(ctx, 0)},
            {adopted: oracleResultsDigest(ctx.flags.oracleResults)},
            {runner: ctx.flags.exploreCmd ?? null, repeat: ctx.flags.exploreRepeat ?? null},
        ];
    },

    async run(ctx) {
        const {feature} = ctx;
        const repeat = Number(ctx.flags.exploreRepeat ?? 3);
        const argv = ctx.flags.exploreCmd ? splitCommand(ctx.flags.exploreCmd) : defaultRunner(repeat);
        const work = path.join(ctx.out, '.work', ctx.stageDirName);
        const plan = {
            schema: 'explorer-feature-plan/v1',
            feature_id: feature.id,
            feature_file: `${ORCH_REPO_PATH}/features/${feature.id}.json`,
            feature_sha256: sha256File(featureFile(feature.id)),
            start_path: feature.start.start_path,
            budget: feature.budget,
            oracles: feature.oracles,
            leakage: {pass: ctx.featureInfo.leakage.pass, violations: ctx.featureInfo.leakage.violations},
            runner: {status: 'planned', command: argv},
            findings_source: 'none',
            run_files: [],
        };
        let outcome = {result: 'skipped', reason: 'skipped: not live'};
        let sources = null;

        if (ctx.flags.oracleResults) {
            const dir = path.resolve(ctx.flags.oracleResults);
            sources = {dir, files: collectRunFiles(dir)};
            plan.runner.status = 'adopted';
            plan.findings_source = 'adopted';
            outcome = sources.files.length
                ? {result: 'pass', reason: 'adopted existing oracle finding files; nothing was run'}
                : {result: 'fail', reason: '--oracle-results holds no <traversal>.run<N>.jsonl files'};
        } else if (ctx.flags.live) {
            fs.rmSync(work, {recursive: true, force: true});
            fs.mkdirSync(work, {recursive: true});
            ctx.writeJson('feature-plan.json', plan, 'orch#feature-plan');
            const resolved = argv.map((a) =>
                a.replaceAll('{work}', work).replaceAll('{plan}', path.join(ctx.dir, 'feature-plan.json')),
            );
            const done = ctx.exec(resolved, {
                cwd: REPO_ROOT,
                env: {...process.env, PILOT_FEATURE_PLAN: path.join(ctx.dir, 'feature-plan.json')},
            });
            plan.runner.status = 'ran';
            plan.findings_source = 'live';
            sources = {dir: work, files: collectRunFiles(work)};
            if (done.status !== 0 || sources.files.length === 0) {
                outcome = {
                    result: 'fail',
                    reason: `oracle runner exit ${done.status}, ${sources.files.length} finding files`,
                };
            } else {
                outcome = {result: 'pass'};
            }
        } else {
            plan.runner.skipped_reason = 'not live';
        }

        if (sources) {
            for (const file of sources.files) {
                const name = file.split('/').join('__');
                fs.mkdirSync(path.join(ctx.dir, 'runs'), {recursive: true});
                fs.copyFileSync(path.join(sources.dir, file), path.join(ctx.dir, 'runs', name));
                plan.run_files.push(`${ctx.stageDirName}/runs/${name}`);
            }
            plan.run_files.sort();
        }
        ctx.writeJson('feature-plan.json', plan, 'orch#feature-plan');
        return outcome;
    },
};
