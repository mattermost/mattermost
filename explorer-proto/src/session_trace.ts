// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import type {Budget} from './bfs.ts';
import type {EvalState, Evaluation, Watch} from './charter.ts';
import {MANIFEST_PATH} from './paths.ts';
import {describe, printable} from './snapshot.ts';
import type {RoleName} from './snapshot.ts';
import type {Skipped} from './trace.ts';

export const SESSION_TRACE_SCHEMA = 'explorer-session-trace/v1';

export type SessionState = EvalState & {
    candidates: RoleName[];
    skipped: Skipped[];
    allowlistedAbsent: RoleName[];
};

export type SessionTransition = {
    n: number;
    from: string;
    action: RoleName;
    to: string;
    changes: string[];
    sameDocument: boolean;
    note?: string;
};

export type SessionEmission = {
    status: 'emitted' | 'stopped' | 'deduped';
    file?: string;
    reasons: string[];
    steps: string[];
};

export type SessionTrace = {
    schema: string;
    session: string;
    featureId: string;
    charter: string;
    start: {path: string; state: string};
    allowlist: RoleName[];
    budget: {limits: Budget; used: {actions: number; states: number; deepest: number; budgetSkips: number}};
    watch: Watch;
    dedupe: {key: string; ledger: string; status: string};
    states: SessionState[];
    transitions: SessionTransition[];
    budgetSkips: Array<{from: string; action: RoleName; reason: string}>;
    guard: {blockedTotal: number; blocked: Record<string, number>; violations: string[]};
    evaluation: Evaluation;
    emission?: SessionEmission;
};

/**
 * Refuses output that carries the run's origin, a loopback host, a seeded id or the seeded password.
 * Only the category is reported, never the value.
 */
export function assertSanitized(label: string, text: string) {
    const checks: Array<[string, string]> = [
        ['loopback host', '127.0.0.1'],
        ['loopback host', 'localhost'],
    ];
    if (fs.existsSync(MANIFEST_PATH)) {
        const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
        const url = new URL(m.base_url);
        checks.push(['origin', url.origin], ['port', `:${url.port}`], ['password', m.user.password]);
        checks.push(['id', m.team.id], ['id', m.user.id]);
        for (const c of Object.values(m.channels ?? {}) as Array<{id: string}>) {
            checks.push(['id', c.id]);
        }
        for (const b of Object.values(m.session?.bookmarks ?? {}) as Array<{id: string}>) {
            checks.push(['id', b.id]);
        }
    }
    const hits = [...new Set(checks.filter(([, v]) => v && text.includes(v)).map(([k]) => k))];
    if (hits.length > 0) {
        throw new Error(`${label} is not sanitized: contains ${hits.join(', ')}`);
    }
}

export function writeSessionTrace(dir: string, trace: SessionTrace) {
    const json = `${JSON.stringify(trace, null, 2)}\n`;
    const md = renderSessionTrace(trace);
    assertSanitized('trace.json', json);
    assertSanitized('trace.md', md);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'trace.json'), json);
    fs.writeFileSync(path.join(dir, 'trace.md'), md);
}

export function readSessionTrace(dir: string): SessionTrace {
    const trace = JSON.parse(fs.readFileSync(path.join(dir, 'trace.json'), 'utf-8')) as SessionTrace;
    if (trace.schema !== SESSION_TRACE_SCHEMA) {
        throw new Error(`Unsupported session trace schema: ${trace.schema}`);
    }
    return trace;
}

function outcome(trace: SessionTrace, t: SessionTransition): string {
    if (t.to === t.from) {
        return 'no-op, same state';
    }
    if (t.note?.includes('deduped')) {
        return 'deduped';
    }
    if (t.note?.includes('max states')) {
        return 'not recorded (budget: max states)';
    }
    return trace.states.some((s) => s.id === t.to) ? 'new state' : 'not recorded';
}

function names(list: RoleName[]): string {
    return list.length ? list.map(describe).join('; ') : 'none';
}

/** Sanitized, deterministic action log in BFS order: what was considered at each state and what was taken. */
function actionLog(trace: SessionTrace): string[] {
    const out: string[] = [];
    const quoted = trace.watch.substrings.map((s) => `'${s}'`).join(' or ');
    for (const s of trace.states) {
        const via = s.via.length ? s.via.map((a) => `click ${describe(a)}`).join(' > ') : '(start)';
        out.push(
            `STATE ${s.id} ${s.pathname} depth ${s.depth} via ${via}; same document: ${s.sameDocument ? 'yes' : 'no'}`,
        );
        for (const c of s.candidates) {
            out.push(`  considered ${describe(c)}: allowlisted, exact, unique -> candidate`);
        }
        for (const a of s.allowlistedAbsent) {
            out.push(`  considered ${describe(a)}: skipped: allowlisted but not present`);
        }
        for (const k of s.skipped.filter((x) => x.reason.includes('ambiguous'))) {
            out.push(`  considered ${describe(k)}: skipped: ${k.reason}`);
        }
        const plain = s.skipped.filter((x) => !x.reason.includes('ambiguous'));
        out.push(`  skipped: not allowlisted (${plain.length}): ${names(plain)}`);
        const live = s.watched.map((w) => `${w.role} "${printable(w.name)}" x${w.count}`).join('; ') || 'none';
        out.push(`  live ${trace.watch.roles.join('/')} names containing ${quoted}: ${live}`);
        for (const t of trace.transitions.filter((x) => x.from === s.id)) {
            const target = trace.states.find((x) => x.id === t.to);
            out.push(
                `  TAKEN #${t.n} click ${describe(t.action)} -> ${target?.pathname ?? '(unrecorded)'} state ${t.to} (${outcome(trace, t)}); diff: ${t.changes.join(', ')}; same document: ${t.sameDocument ? 'yes' : 'no'}${t.note ? `; ${t.note}` : ''}`,
            );
        }
        for (const b of trace.budgetSkips.filter((x) => x.from === s.id)) {
            out.push(`  NOT TAKEN click ${describe(b.action)}: skipped: budget (${b.reason})`);
        }
    }
    return out;
}

export function renderSessionTrace(trace: SessionTrace): string {
    const {limits, used} = trace.budget;
    const ev = trace.evaluation;
    const out: string[] = [
        `# Explorer session trace: ${trace.session}`,
        '',
        `Generated by \`explorer-proto/src/cli.ts explore --session=${trace.session}\` (and \`emit --session=${trace.session}\` for the last section) from \`${trace.charter}\`. Deterministic: no ports, ids, origins or timestamps.`,
        '',
        `- Feature: ${trace.featureId}`,
        `- Start: navigate ${trace.start.path} -> state ${trace.start.state}`,
        `- Allowlist (unordered set, sorted; exact role + name): ${names(trace.allowlist)}`,
        `- Budget (from the charter): max ${limits.maxActions} actions, max depth ${limits.maxDepth}, max ${limits.maxStates} states.`,
        `- Used: ${used.actions} actions, ${used.states} states, deepest state at depth ${used.deepest}, ${used.budgetSkips} candidates left unexplored by the budget.`,
        `- Dedupe: key ${trace.dedupe.key}: ${trace.dedupe.status} (ledger ${trace.dedupe.ledger}).`,
        `- Live-name report (locator_scope.live_name_status): role ${trace.watch.roles.join('/')} with a name containing ${trace.watch.substrings.map((s) => `'${s}'`).join(' or ')}.`,
        `- Network guard (exploration): ${trace.guard.blockedTotal} requests blocked, ${trace.guard.violations.length} violations.`,
        ...Object.entries(trace.guard.blocked).map(([key, count]) => `  - blocked ${key}: ${count}`),
        ...trace.guard.violations.map((v) => `  - VIOLATION ${v}`),
        '',
        '## Action log',
        '',
        '```text',
        ...actionLog(trace),
        '```',
        '',
        '## Predicate evaluation',
        '',
        'Expected values come only from the charter. The snapshot decides whether a state qualifies; a testid without a role has no snapshot node and is asserted by the replay locator.',
        '',
    ];
    for (const p of ev.predicates) {
        out.push(
            `### ${p.id}`,
            '',
            `- applies to: URL path ${p.urlPath}${p.appliesToStart ? ' (includes the start state)' : ''}${p.requiresSameDocument ? ', no page reload' : ''}`,
        );
        for (const r of p.results) {
            let verdict = r.applies ? 'does not qualify' : 'not applicable';
            if (r.qualifies) {
                verdict = 'QUALIFIES';
            }
            out.push(
                `- state ${r.state} ${r.pathname} via ${r.path.join(' > ') || '(start)'}: ${verdict} (${r.appliesDetail})`,
            );
            if (r.applies) {
                for (const e of r.expectations) {
                    out.push(`  - ${e.id}: ${e.status}: ${e.detail}`);
                }
            }
        }
        out.push(`- qualifying states: ${p.qualifying.join(', ') || 'none'}`, '');
    }
    out.push('### Selection', '');
    if (ev.selection) {
        out.push(
            `- predicate ${ev.selection.predicate}: rule ${ev.selection.rule}`,
            ...ev.selection.candidates.map((c) => `  - candidate ${c}`),
            `- selected: state ${ev.selection.state} via ${ev.selection.path.join(' > ') || '(start)'}`,
        );
    } else {
        out.push('- no discovered state qualifies for the target predicate; nothing can be emitted');
    }
    for (const m of ev.nameMismatches) {
        out.push(`- LIVE NAME MISMATCH ${m}`);
    }
    for (const p of ev.problems) {
        out.push(`- PROBLEM ${p}`);
    }
    if (trace.emission) {
        const e = trace.emission;
        out.push('', '## Emission', '', `- status: ${e.status}${e.file ? ` -> ${e.file}` : ''}`);
        out.push(...e.reasons.map((r) => `- ${r}`), ...e.steps.map((s) => `- step: ${s}`));
    }
    return `${out.join('\n').trimEnd()}\n`;
}
