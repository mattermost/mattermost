// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {test} from '@mattermost/playwright-lib';

import {assertStableAllowlist, runBfs} from './bfs.ts';
import {
    charterAllowlist,
    charterBudget,
    charterPath,
    charterWatch,
    dedupeStatus,
    evaluateCharter,
    readCharter,
    watchedNames,
} from './charter.ts';
import {summarize} from './guard.ts';
import {allowedOrigin} from './manifest.ts';
import {PROTO_DIR, outDir, sessionName} from './paths.ts';
import {closeGuardedSessions} from './session.ts';
import {SESSION_TRACE_SCHEMA, writeSessionTrace} from './session_trace.ts';
import type {SessionState, SessionTrace, SessionTransition} from './session_trace.ts';
import {normalizeSnapshot} from './snapshot.ts';

test.afterEach(closeGuardedSessions);

test('explore a charter session by bounded BFS over aria snapshots', async ({pw}) => {
    test.setTimeout(30 * 60_000);
    const session = sessionName();
    if (!session) {
        throw new Error('explore_session.pw.ts needs PILOT_SESSION (cli.ts explore --session=<name>).');
    }
    const charter = readCharter(session);
    const allow = charterAllowlist(charter);
    assertStableAllowlist(allow);
    const budget = charterBudget(charter);
    const watch = charterWatch(charter);
    const root = charter.start.start_path;

    // Link targets can be absolute URLs on the run's origin; the origin must not reach state keys or the trace.
    const origin = allowedOrigin();
    const normalize = (raw: string) => normalizeSnapshot(raw.split(origin).join('<origin>'));

    const result = await runBfs(pw, {
        roots: [root],
        allow,
        budget,
        normalize,
        session: {observe: (raw) => ({watched: watchedNames(raw.split(origin).join('<origin>'), watch)})},
    });

    const states = result.states.map((s): SessionState => ({
        id: s.id,
        depth: s.depth,
        pathname: s.pathname,
        via: s.via,
        viaTransitions: s.viaTransitions ?? [],
        sameDocument: Boolean(s.sameDocument),
        candidates: s.candidates,
        skipped: s.skipped,
        allowlistedAbsent: s.allowlistedAbsent,
        watched: s.watched as SessionState['watched'],
        snapshot: s.snapshot,
    }));
    const transitions = result.transitions.map((t): SessionTransition => ({
        n: t.n,
        from: t.from,
        action: t.action,
        to: t.to,
        changes: t.changes,
        sameDocument: Boolean(t.sameDocument),
        ...(t.note ? {note: t.note} : {}),
    }));
    const startState = states.find((s) => s.depth === 0)?.id ?? 'none';
    const blocked = result.ledgers.flatMap((l) => l.blocked);
    const trace: SessionTrace = {
        schema: SESSION_TRACE_SCHEMA,
        session,
        featureId: charter.feature_id,
        charter: path.relative(PROTO_DIR, charterPath(session)).split(path.sep).join('/'),
        start: {path: root, state: startState},
        allowlist: allow,
        budget: {
            limits: budget,
            used: {
                actions: result.actions,
                states: states.length,
                deepest: Math.max(...states.map((s) => s.depth)),
                budgetSkips: result.budgetSkips.length,
            },
        },
        watch,
        dedupe: {key: charter.dedupe.key, ledger: 'coverage.md', status: dedupeStatus(charter).status},
        states,
        transitions,
        budgetSkips: result.budgetSkips,
        guard: {
            blockedTotal: blocked.length,
            blocked: summarize(blocked),
            violations: result.ledgers.flatMap((l) => l.violations),
        },
        evaluation: evaluateCharter(charter, states, startState),
    };
    writeSessionTrace(outDir(), trace);
});
