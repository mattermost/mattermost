// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import type {JourneyCharter} from './journey_charter.ts';
import {WEIGHTS, scoreChild} from './journey_score.ts';
import type {ObservedState, SearchResult} from './journey_search.ts';
import {describe} from './snapshot.ts';

export const JOURNEY_TRACE_SCHEMA = 'explorer-journey-trace/v1';

const HEURISTIC = [
    `score(child) = ${WEIGHTS.checkpoint}*fullCheckpoints + ${WEIGHTS.event}*firedEvents + ${WEIGHTS.container}*containerOpen + ${WEIGHTS.partial}*partialClauses + ${WEIGHTS.novelty}*novelty + ${WEIGHTS.lexical}*lexical - ${WEIGHTS.depth}*depth`,
    '- fullCheckpoints: number of checkpoints fully satisfied at/through the parent state (REST and UI).',
    '- firedEvents: number of charter events fired so far in the replay.',
    '- containerOpen: 1 when a menu or dialog is open at the parent state (modal_policy: drill through it), else 0.',
    '- partialClauses: number of individually-satisfied checkpoint clauses (tiny weight; a structurally-true clause cannot dominate).',
    '- novelty: 1 when the parent state was a new URL path or a new normalized snapshot, else 0.',
    '- lexical: count of distinct goal_terms (goal minus stopwords, stemmed) present in the candidate accessible name.',
    '- depth: number of actions from the start.',
    `- fatigue (applied at selection time): the effective priority subtracts ${WEIGHTS.fatigue} per prior actuation of the same (role, name) anywhere, so the search stops re-toggling one control across a modal's combinations. Ties: higher effective score first, then (name, role) lexicographic, then shorter path.`,
];

/** Generic scrub of always-volatile values (loopback origin/host/port, 26-char server ids, clock times). */
function scrubVolatile(text: string): string {
    let out = text;
    if (process.env.PW_BASE_URL) {
        const url = new URL(process.env.PW_BASE_URL);
        out = out.split(url.origin).join('<origin>');
        if (url.port) {
            out = out.split(`:${url.port}`).join(':<port>');
        }
    }
    out = out
        .split('http://127.0.0.1')
        .join('<origin>')
        .split('127.0.0.1')
        .join('<host>')
        .split('localhost')
        .join('<host>');
    out = out.replace(/(?<![a-z0-9])[a-z0-9]{26}(?![a-z0-9])/g, '<id>');
    out = out.replace(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\b/g, '<time>');
    return out;
}

/** Final safety net: the rendered trace must carry no loopback host, origin, port or 26-char id. */
function assertSanitized(label: string, text: string) {
    const hits: string[] = [];
    for (const [name, needle] of [
        ['loopback host', '127.0.0.1'],
        ['loopback host', 'localhost'],
    ] as const) {
        if (text.includes(needle)) {
            hits.push(name);
        }
    }
    if (process.env.PW_BASE_URL) {
        const url = new URL(process.env.PW_BASE_URL);
        if (text.includes(url.origin)) {
            hits.push('origin');
        }
        if (url.port && text.includes(`:${url.port}`)) {
            hits.push('port');
        }
    }
    if (/(?<![a-z0-9])[a-z0-9]{26}(?![a-z0-9])/.test(text)) {
        hits.push('26-char id');
    }
    if (hits.length > 0) {
        throw new Error(`${label} is not sanitized: contains ${[...new Set(hits)].join(', ')}`);
    }
}

function candidateLines(state: ObservedState, goalTerms: Set<string>): string[] {
    const scored = state.candidates
        .map((c) => ({c, s: scoreChild(state, c, goalTerms)}))
        .sort((a, b) => b.s.total - a.s.total || (a.c.name < b.c.name ? -1 : 1));
    return scored.map(
        ({c, s}) =>
            `  considered ${describe(c)}: score ${s.total} = ${WEIGHTS.checkpoint}*${s.checkpoint}(full) + ${WEIGHTS.event}*${s.event}(event) + ${WEIGHTS.container}*${s.container}(container) + ${WEIGHTS.partial}*${s.partial}(partial) + ${WEIGHTS.novelty}*${s.novelty}(novelty) + ${WEIGHTS.lexical}*${s.lexical}(lexical) - ${WEIGHTS.depth}*${s.depth}(depth)`,
    );
}

function checkpointLine(state: ObservedState): string[] {
    const out: string[] = [];
    for (const r of state.restResults) {
        out.push(
            `  checkpoint ${r.id} (rest): ${r.ok ? 'TRUE' : 'false'} [${r.clauses.map((c) => `${c.desc}:${c.ok ? 'ok' : 'no'}`).join('; ')}]`,
        );
    }
    for (const u of state.uiResults) {
        out.push(
            `  checkpoint ${u.id} (ui): ${u.ok ? 'TRUE' : 'false'} [${u.clauses.map((c) => `${c.desc}:${c.ok ? 'ok' : 'no'}`).join('; ')}]${u.observation.length ? ` (observed via: ${u.observation.join(', ')})` : ''}`,
        );
    }
    return out;
}

function reportLive(state: ObservedState): string[] {
    const r = state.threadsReport;
    if (!r) {
        return [];
    }
    return [
        `  REPORT LIVE (followed-thread view ${r.pathname}):`,
        `    tabs: ${r.tabs.join('; ') || 'none'}`,
        `    tabpanel links: ${r.tabpanelLinks.join('; ') || 'none'}`,
        `    headings: ${r.headings.join('; ') || 'none'}`,
        `    snapshot exposes row child text: ${r.snapshotExposesRowText === null ? 'n/a (no row)' : r.snapshotExposesRowText}`,
    ];
}

function actionLog(result: SearchResult, goalTerms: Set<string>): string[] {
    const out: string[] = [];
    for (const s of result.states) {
        const via = s.via.length ? s.via.map((a) => `click ${describe(a)}`).join(' > ') : '(start)';
        out.push(
            `STATE ${s.id} ${s.pathname} depth ${s.depth} via ${via}; same document: ${s.sameDocument ? 'yes' : 'no'}`,
        );
        out.push(`  regions seen: ${s.regions.join(', ')}`);
        if (s.unidentifiedLandmarks.length) {
            out.push(
                `  UNIDENTIFIED landmarks (treated conservatively, kept in play): ${s.unidentifiedLandmarks.join('; ')}`,
            );
        }
        out.push(...checkpointLine(s));
        out.push(...reportLive(s));
        out.push(...candidateLines(s, goalTerms));
        const skippedByReason = s.skipped.length
            ? s.skipped.map((k) => `${describe(k)} [${k.reason}]`).join('; ')
            : 'none';
        out.push(`  skipped candidates: ${skippedByReason}`);
        for (const t of result.transitions.filter((x) => x.from === s.id)) {
            const became = t.checkpointsBecameTrue.length
                ? `; checkpoints became true: ${t.checkpointsBecameTrue.join(', ')}`
                : '';
            const fired = t.eventFirings.length ? `; events: ${t.eventFirings.join(' | ')}` : '';
            out.push(
                `  TAKEN #${t.n} click ${describe(t.action)} (score ${t.score.total}) -> state ${t.to} (${t.outcome})${became}${fired}`,
            );
        }
        for (const b of result.budgetSkips.filter((x) => x.from === s.id)) {
            out.push(`  NOT TAKEN ${describe(b.action)}: ${b.reason}`);
        }
        out.push('');
    }
    return out;
}

export function renderJourneyTrace(charter: JourneyCharter, result: SearchResult): string {
    const goalTerms = new Set(result.goalTerms);
    const c = result.counters;
    const out: string[] = [
        `# Explorer journey trace: ${charter.journey_id}`,
        '',
        'Generated by `explorer-proto/src/cli.ts explore --journey`. Deterministic and sanitized: no ports, origins, ids, slugs, passwords or timestamps (slugs and ids are placeholders). Wall-clock numbers live in stats.json.',
        '',
        `- Journey: ${charter.journey_id}`,
        `- Features: ${charter.feature_id.join(', ')}`,
        `- Goal terms (goal minus stopwords, stemmed): ${result.goalTerms.join(', ')}`,
        `- Start: ${charter.start.actor} navigates ${charter.start.start_path}`,
        `- Budget: max ${charter.budget.max_actions} actions, depth ${charter.budget.max_depth}, ${charter.budget.max_states} states, ${charter.budget.max_replays} replays, ${charter.budget.wall_clock_seconds}s.`,
        `- Used: ${c.actions} actions, ${c.replays} replays, ${c.states} states, deepest depth ${c.deepest}, ${c.qualifyingReplays} qualifying/confirmation replays.`,
        `- Stopped: ${result.stoppedReason}.`,
        '- Heuristic:',
        ...HEURISTIC.map((h) => `  ${h}`),
        `- Server preconditions (read-only GET /config): ${result.serverPreconditions.join('; ')}`,
        `- Network guard (exploration): ${result.guardViolations.length} violations.`,
        ...result.guardViolations.map((v) => `  - VIOLATION ${v}`),
        `- Best-path checkpoint progress reached: ${
            Object.entries(result.checkpointProgressBest)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') || 'none'
        }`,
        `- UI checkpoint observation methods used: ${result.observations.join(', ') || 'none'}`,
        '',
        '## Qualified journey',
        '',
    ];
    if (result.qualified) {
        out.push(
            `- QUALIFIED (${result.qualified.path.length} actions): ${result.qualified.path.map(describe).join(' > ')}`,
            `- Confirmed on a fresh fixture: yes`,
            `- Event split (actions before the teammate event): ${Object.entries(result.qualified.eventStep)
                .map(([k, v]) => `${k} after action ${v}`)
                .join(', ')}`,
            `- C3 row text exposed by the aria snapshot: ${result.qualified.c3SnapshotExposesRowText}`,
            `- UI checkpoint observation methods: ${result.qualified.uiObservations.join(', ') || 'none'}`,
            `- Selection: fewest actions then lexicographically smallest, over ${result.qualifyingPaths.filter((q) => q.confirmed).length} confirmed path(s).`,
            '',
        );
    } else {
        out.push(
            '- NO qualifying journey within budget.',
            `- Best frontier remaining (path: score):`,
            ...result.bestFrontier.map((f) => `  - ${f.path || '(start)'}: ${f.score}`),
            '',
        );
    }

    out.push('## Action log', '', '```text', ...actionLog(result, goalTerms), '```', '');

    const text = scrubVolatile(`${out.join('\n').trimEnd()}\n`);
    assertSanitized('journey trace.md', text);
    return text;
}

export function journeyTraceJson(charter: JourneyCharter, result: SearchResult): string {
    const json = {
        schema: JOURNEY_TRACE_SCHEMA,
        journey_id: charter.journey_id,
        feature_id: charter.feature_id,
        goal_terms: result.goalTerms,
        heuristic: {weights: WEIGHTS},
        counters: result.counters,
        stopped_reason: result.stoppedReason,
        server_preconditions: result.serverPreconditions,
        guard_violations: result.guardViolations,
        checkpoint_progress_best: result.checkpointProgressBest,
        observations: result.observations,
        qualified: result.qualified
            ? {
                  path: result.qualified.path,
                  confirmed: true,
                  eventStep: result.qualified.eventStep,
                  stepPathnames: result.qualified.stepPathnames,
                  c3SnapshotExposesRowText: result.qualified.c3SnapshotExposesRowText,
                  uiObservations: result.qualified.uiObservations,
              }
            : null,
        qualifying_paths: result.qualifyingPaths.map((q) => ({
            path: q.path,
            confirmed: q.confirmed,
        })),
        states: result.states.map((s) => ({
            id: s.id,
            pathname: s.pathname,
            depth: s.depth,
            via: s.via,
            viaTransitions: s.viaTransitions,
            novelty: s.novelty,
            progress: s.progress,
            candidates: s.candidates,
            skipped: s.skipped,
            regions: s.regions,
            unidentifiedLandmarks: s.unidentifiedLandmarks,
            restResults: s.restResults,
            uiResults: s.uiResults,
            threadsReport: s.threadsReport,
            sameDocument: s.sameDocument,
        })),
        transitions: result.transitions,
        budgetSkips: result.budgetSkips,
    };
    const text = scrubVolatile(`${JSON.stringify(json, null, 2)}\n`);
    assertSanitized('journey trace.json', text);
    return text;
}

export function writeJourneyTrace(dir: string, charter: JourneyCharter, result: SearchResult) {
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'trace.md'), renderJourneyTrace(charter, result));
    fs.writeFileSync(path.join(dir, 'trace.json'), journeyTraceJson(charter, result));
    // Wall-clock stats are deliberately kept out of the compared trace.
    fs.writeFileSync(
        path.join(dir, 'stats.json'),
        `${JSON.stringify({wall_clock_seconds: result.wallClockSeconds, counters: result.counters}, null, 2)}\n`,
    );
}
