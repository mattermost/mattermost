// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {assertStableAllowlist, runBfs} from './bfs.ts';
import {summarize} from './guard.ts';
import {outDir} from './paths.ts';
import {allowlist, readScenarios, startPath} from './scenarios.ts';
import {closeGuardedSessions} from './session.ts';
import {TRACE_SCHEMA, writeTrace} from './trace.ts';
import type {Trace} from './trace.ts';

const BUDGET = {maxActions: 12, maxDepth: 3, maxStates: 10};

test.afterEach(closeGuardedSessions);

test('explore Channel Info scenarios by bounded BFS over aria snapshots', async ({pw}) => {
    test.setTimeout(30 * 60_000);
    const scenarios = readScenarios();
    const allow = allowlist(scenarios).map(({role, name}) => ({role, name}));
    assertStableAllowlist(allow);
    const roots = [...new Set(scenarios.map(startPath))].sort();

    const {states, transitions, budgetSkips, ledgers, actions} = await runBfs(pw, {roots, allow, budget: BUDGET});

    const blocked = ledgers.flatMap((l) => l.blocked);
    const trace: Trace = {
        schema: TRACE_SCHEMA,
        allowlist: allow,
        budget: {
            limits: BUDGET,
            used: {
                actions,
                states: states.length,
                deepest: Math.max(...states.map((s) => s.depth)),
                budgetSkips: budgetSkips.length,
            },
        },
        roots: roots.map((path) => ({path, state: states.find((s) => s.root === path && s.depth === 0)?.id ?? 'none'})),
        states,
        transitions,
        budgetSkips,
        guard: {
            blockedTotal: blocked.length,
            blocked: summarize(blocked),
            violations: ledgers.flatMap((l) => l.violations),
        },
    };
    writeTrace(outDir(), trace);
});
