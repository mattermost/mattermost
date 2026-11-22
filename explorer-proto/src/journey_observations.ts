// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {assertSanitized, scrubVolatile} from './journey_trace.ts';
import type {RoleName} from './snapshot.ts';
import {compareStrings} from './snapshot.ts';

export const OBSERVATION_LOG_FILE = 'observations.jsonl';
export const OUTCOME_REPORT_FILE = 'report.json';
export const OBSERVATION_STATS_FILE = 'observation-stats.json';
export const OUTCOME_REPORT_SCHEMA = 'explorer-journey-outcome-report/v1';

export type LogEntry = Record<string, unknown> & {seq: number; prev_sha256: string; kind: string};

function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Append-only JSONL log. Each line carries `seq` and `prev_sha256` (sha256 of every byte before it), is
 * sanitized before it is written, and is appended with the OS append flag. Nothing is ever rewritten; an
 * existing non-empty log is refused so a second run cannot overwrite a first one.
 */
export class ObservationLog {
    readonly file: string;
    private content = '';
    private readonly entries: LogEntry[] = [];
    private readonly onAppend?: (file: string) => void;

    constructor(file: string, onAppend?: (file: string) => void) {
        this.file = file;
        this.onAppend = onAppend;
        fs.mkdirSync(path.dirname(file), {recursive: true});
        if (fs.existsSync(file)) {
            if (fs.statSync(file).size > 0) {
                throw new Error(
                    `${path.basename(file)} already exists in the output directory; observations are append-only, so use a fresh --out`,
                );
            }
        } else {
            fs.writeFileSync(file, '', {flag: 'wx'});
        }
    }

    /** Appends one entry; `forbidden` values (slugs, passwords, tokens) must not occur in the written line. */
    append(entry: Record<string, unknown> & {kind: string}, forbidden: string[] = []): LogEntry {
        const full = {seq: this.entries.length + 1, prev_sha256: sha256(this.content), ...entry};
        const line = scrubVolatile(JSON.stringify(full));
        assertSanitized('observation log entry', line);
        for (const value of forbidden) {
            if (value && line.includes(value)) {
                throw new Error('observation log entry is not sanitized: contains a fixture secret or token');
            }
        }
        fs.appendFileSync(this.file, `${line}\n`, {flag: 'a'});
        this.content += `${line}\n`;
        const parsed = JSON.parse(line) as LogEntry;
        this.entries.push(parsed);
        this.onAppend?.(this.file);
        return structuredClone(parsed);
    }

    all(): LogEntry[] {
        return structuredClone(this.entries);
    }
}

export type StateRecord = {
    seq: number;
    replay: string;
    replayKind: 'start' | 'expansion' | 'confirmation';
    stateKey: string;
    urlPath: string;
    path: RoleName[];
    pathKey: string;
    cls: string | null;
    matched: string[];
    results: Record<string, boolean | null>;
};

export type ConfirmationRecord = {
    cls: string;
    path: RoleName[];
    pathKey: string;
    attempted: boolean;
    confirmed: boolean;
    replay: string | null;
    reachedClass: string | null;
    reason: string;
};

export type OutcomeResult = {
    verdict: string;
    verdictRule: string;
    setupFailure: {phase: string; message: string; replay: string} | null;
    serverPreconditions: string[];
    buildIdentity: Array<[string, string]>;
    states: StateRecord[];
    confirmations: ConfirmationRecord[];
    preserveClasses: string[];
    confirmOrder: string[];
    classNames: string[];
    evidence: Record<string, Record<string, number>>;
    replayErrors: Array<{replay: string; path: RoleName[]; message: string}>;
    reserve: {reserved: number; confirmationReplays: number; expansionReplays: number};
    log: LogEntry[];
    timings: Array<{seq: number; checkpoint: string; settle_ms_used: number}>;
};

function describePath(p: RoleName[]): string {
    return p.length ? p.map((a) => `${a.role} "${a.name}"`).join(' > ') : '(start)';
}

function compareSequence(a: RoleName[], b: RoleName[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const c = compareStrings(a[i].name, b[i].name) || compareStrings(a[i].role, b[i].role);
        if (c) {
            return c;
        }
    }
    return a.length - b.length;
}

export function selectRepresentative<T extends {path: RoleName[]}>(items: T[]): T | null {
    return [...items].sort((a, b) => a.path.length - b.path.length || compareSequence(a.path, b.path))[0] ?? null;
}

/** The report the charter's observation_policy.report_shape lists, deterministic and sanitized. */
export function buildOutcomeReport(journeyId: string, o: OutcomeResult): Record<string, unknown> {
    const confirmationOf = (cls: string, pathKey: string) =>
        o.confirmations.find((c) => c.cls === cls && c.pathKey === pathKey);
    const failing = o.states
        .filter((s) => s.cls !== null && o.preserveClasses.includes(s.cls))
        .map((s) => {
            const c = confirmationOf(s.cls!, s.pathKey);
            return {
                log_seq: s.seq,
                replay: s.replay,
                replay_kind: s.replayKind,
                classification: s.cls,
                state: s.stateKey,
                url_path: s.urlPath,
                path: s.path,
                path_text: describePath(s.path),
                confirmed: c?.attempted ? c.confirmed : 'not attempted',
                confirmation_replay: c?.replay ?? null,
                confirmation_note: c?.reason ?? 'no confirmation recorded',
            };
        });
    const representative: Record<string, unknown> = {};
    for (const cls of o.classNames) {
        const confirmed = o.confirmations.filter((c) => c.cls === cls && c.confirmed);
        const pick = selectRepresentative(confirmed);
        representative[cls] = pick
            ? {path: pick.path, path_text: describePath(pick.path), confirmation_replay: pick.replay}
            : null;
    }
    const statesPerClass: Record<string, {distinct_states: number; observations: number}> = {};
    for (const cls of [...o.classNames, 'UNCLASSIFIED']) {
        const matching = o.states.filter((s) => (s.cls ?? 'UNCLASSIFIED') === cls);
        statesPerClass[cls] = {
            distinct_states: new Set(matching.map((s) => s.stateKey)).size,
            observations: matching.length,
        };
    }
    const byState = new Map<string, Set<string>>();
    const byPath = new Map<string, {path: RoleName[]; classes: Set<string>}>();
    for (const s of o.states) {
        const cls = s.cls ?? 'UNCLASSIFIED';
        byState.set(s.stateKey, (byState.get(s.stateKey) ?? new Set()).add(cls));
        const p = byPath.get(s.pathKey) ?? {path: s.path, classes: new Set<string>()};
        p.classes.add(cls);
        byPath.set(s.pathKey, p);
    }
    const flakiness = [
        ...[...byState.entries()]
            .filter(([, classes]) => classes.size > 1)
            .map(([state, classes]) => ({
                kind: 'same state key, different classifications',
                state,
                classifications: [...classes].sort(compareStrings),
                log_seqs: o.states.filter((s) => s.stateKey === state).map((s) => s.seq),
            })),
        ...[...byPath.values()]
            .filter((p) => p.classes.size > 1)
            .map((p) => ({
                kind: 'same action path, different classifications',
                path_text: describePath(p.path),
                classifications: [...p.classes].sort(compareStrings),
            })),
    ];
    return {
        schema: OUTCOME_REPORT_SCHEMA,
        journey_id: journeyId,
        run_verdict: o.verdict,
        verdict_rule: o.verdictRule,
        setup_failure: o.setupFailure,
        server_preconditions: o.serverPreconditions,
        build_identity: Object.fromEntries(o.buildIdentity),
        failing_observations: failing,
        representative_confirmed_path: representative,
        states_per_classification: statesPerClass,
        evidence_method_per_string: o.evidence,
        confirmations: o.confirmations.map((c) => ({
            classification: c.cls,
            path: c.path,
            path_text: describePath(c.path),
            attempted: c.attempted,
            confirmed: c.confirmed,
            replay: c.replay,
            reached_classification: c.reachedClass,
            note: c.reason,
        })),
        confirmation_order: o.confirmOrder,
        flakiness,
        replay_errors: o.replayErrors.map((e) => ({
            replay: e.replay,
            path_text: describePath(e.path),
            message: e.message,
        })),
        budget_reserve: o.reserve,
        observation_log: {file: OBSERVATION_LOG_FILE, entries: o.log.length},
    };
}

export function renderOutcomeReport(journeyId: string, o: OutcomeResult): string {
    const text = scrubVolatile(`${JSON.stringify(buildOutcomeReport(journeyId, o), null, 2)}\n`);
    assertSanitized('journey report.json', text);
    return text;
}

/** trace.md section for outcome charters. */
export function outcomeTraceLines(o: OutcomeResult): string[] {
    const lines = [
        '## Verdict',
        '',
        `- Run verdict: ${o.verdict} (precedence entry: ${o.verdictRule})`,
        `- Setup failure: ${o.setupFailure ? `${o.setupFailure.phase} in ${o.setupFailure.replay}: ${o.setupFailure.message}` : 'none'}`,
        `- Build identity (client config, reported verbatim, never asserted): ${
            o.buildIdentity.map(([k, v]) => `${k}=${v}`).join(', ') || 'none read'
        }`,
        `- Confirmation reserve: ${o.reserve.reserved} replay(s) held back; confirmation replays run ${o.reserve.confirmationReplays}; expansion replays ${o.reserve.expansionReplays}.`,
        `- Observation log: ${OBSERVATION_LOG_FILE} (${o.log.length} append-only entries); report: ${OUTCOME_REPORT_FILE}.`,
        '',
        '### Classified states',
        '',
    ];
    for (const s of o.states) {
        lines.push(
            `- #${s.seq} ${s.replay} (${s.replayKind}) state ${s.stateKey} ${s.urlPath}: ${s.cls ?? 'UNCLASSIFIED'} via ${describePath(s.path)}`,
        );
    }
    lines.push('', '### Confirmations', '');
    for (const c of o.confirmations) {
        let status = 'not attempted';
        if (c.attempted) {
            status = c.confirmed ? 'CONFIRMED' : 'NOT confirmed';
        }
        lines.push(
            `- ${c.cls} via ${describePath(c.path)}: ${status}${c.replay ? ` (${c.replay}, reached ${c.reachedClass ?? 'UNCLASSIFIED'})` : ''}; ${c.reason}`,
        );
    }
    if (o.confirmations.length === 0) {
        lines.push('- none');
    }
    lines.push('');
    return lines;
}
