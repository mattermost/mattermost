// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nodePath from 'node:path';

import type {Page} from '@playwright/test';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import type {Observed} from './bfs.ts';
import {resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyCharter} from './journey_charter.ts';
import {enumerateCandidates, ESCAPE} from './journey_actions.ts';
import type {SkippedCandidate} from './journey_actions.ts';
import {
    SetupFailure,
    checkClientConfigPreconditions,
    checkServerPreconditions,
    clientConfigRequestPath,
    createFixture,
    readBack,
} from './journey_fixture.ts';
import type {Fixture} from './journey_fixture.ts';
import {OBSERVATION_LOG_FILE, ObservationLog} from './journey_observations.ts';
import type {ConfirmationRecord, LogEntry, OutcomeResult, StateRecord} from './journey_observations.ts';
import {observeUi, uiRules} from './journey_observe.ts';
import type {UiObservation} from './journey_observe.ts';
import {
    CharterRuleError,
    classify,
    confirmationKey,
    decideVerdict,
    hasOutcomes,
    validateOutcomeCharter,
} from './journey_outcomes.ts';
import {outDir} from './paths.ts';
import {evalRestCheckpoint, fireEvent} from './journey_rest.ts';
import type {CheckpointResult} from './journey_rest.ts';
import {evalUiCheckpoint, threadsReport} from './journey_ui.ts';
import type {ThreadsReport, UiCheckpointResult} from './journey_ui.ts';
import {goalTerms as deriveGoalTerms} from './journey_charter.ts';
import {scoreChild, WEIGHTS} from './journey_score.ts';
import type {Progress, ScoreComponents} from './journey_score.ts';
import {closeGuardedSession, openGuardedSessionAs} from './session.ts';
import {compareStrings, describe, normalizeSnapshot, stateKey} from './snapshot.ts';
import type {RoleName} from './snapshot.ts';

const DOCUMENT_MARKER = '__journeyDocMarker';
const TRIGGER_WAIT_MS = 600;
const RESULT_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 250;

const SETTLE_POLL_MS = 200;
const SETTLE_STABLE_POLLS = 3;
const SETTLE_TIMEOUT_MS = 12000;

/**
 * Journey-local settle: waits for load then polls the normalized snapshot until it stops changing.
 * It deliberately does not wait for networkidle (Mattermost keeps a WebSocket open, so networkidle
 * rarely fires and would cost ~10s per step).
 */
async function journeySettle(page: Page, normalize: (raw: string) => string): Promise<Observed> {
    await page.waitForLoadState('load');
    await page.mouse.move(0, 0);
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let last = '';
    let stable = 0;
    for (;;) {
        const raw = await page.locator('body').ariaSnapshot();
        const normalized = normalize(raw);
        stable = normalized === last ? stable + 1 : 0;
        last = normalized;
        if (stable >= SETTLE_STABLE_POLLS) {
            return {pathname: new URL(page.url()).pathname, normalized, raw};
        }
        if (Date.now() > deadline) {
            return {pathname: new URL(page.url()).pathname, normalized, raw};
        }
        await page.waitForTimeout(SETTLE_POLL_MS);
    }
}

export type CandidateConsidered = RoleName & {score: ScoreComponents};

export type ObservedState = {
    id: string;
    pathname: string;
    depth: number;
    via: RoleName[];
    viaTransitions: number[];
    novelty: number;
    progress: Progress;
    containerOpen: boolean;
    candidates: RoleName[];
    skipped: SkippedCandidate[];
    regions: string[];
    unidentifiedLandmarks: string[];
    restResults: CheckpointResult[];
    uiResults: UiCheckpointResult[];
    threadsReport: ThreadsReport | null;
    sameDocument: boolean;
};

export type Transition = {
    n: number;
    from: string;
    action: RoleName;
    to: string;
    score: ScoreComponents;
    outcome: string;
    changes: string[];
    sameDocument: boolean;
    checkpointsBecameTrue: string[];
    eventFirings: string[];
};

export type BudgetSkip = {from: string; action: RoleName; reason: string};

export type SearchResult = {
    goalTerms: string[];
    states: ObservedState[];
    transitions: Transition[];
    budgetSkips: BudgetSkip[];
    counters: {
        actions: number;
        replays: number;
        states: number;
        deepest: number;
        qualifyingReplays: number;
    };
    qualified: {
        path: RoleName[];
        eventStep: Record<string, number>;
        stepPathnames: string[];
        c3SnapshotExposesRowText: boolean | null;
        uiObservations: string[];
    } | null;
    qualifyingPaths: Array<{path: RoleName[]; confirmed: boolean}>;
    serverPreconditions: string[];
    guardViolations: string[];
    stoppedReason: string;
    bestFrontier: Array<{path: string; score: number}>;
    wallClockSeconds: number;
    checkpointProgressBest: Record<string, boolean>;
    observations: string[];
    /** Present only for charters that declare success_criteria.outcomes. */
    outcomes?: OutcomeResult;
};

export type SearchOptions = {
    /** Directory for observations.jsonl (default: the journey's generated dir). */
    outDir?: string;
    /** Called after every observation-log append (selftests hash the log prefix here). */
    onObservationAppend?: (file: string) => void;
};

type ReplayKind = 'start' | 'expansion' | 'confirmation';

type Trajectory = {
    everTrue: Map<string, boolean>;
    everTrueAfterEvent: Map<string, boolean>;
    eventFired: Set<string>;
    eventStep: Record<string, number>;
    eventFiringLog: string[];
    becameTrue: string[];
    c3RowTextExposed: boolean | null;
    stepPathnames: string[];
    stepStateIds: string[];
    c1AtEnd: boolean;
    qualifies: boolean;
};

type ReplayOutcome = {
    terminal: ObservedState;
    trajectory: Trajectory;
    guardViolations: string[];
    replayId: string;
    /** Outcome mode: per-state classification by depth along the replayed path. */
    stepClasses: Array<string | null>;
};

const SETUP_PHASES = new Set(['server preconditions', 'fixture', 'read-back', 'end-of-replay read-back']);

function escapeRe(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pathKeyOf(p: RoleName[]): string {
    return p.map((a) => `${a.role}\u0000${a.name}`).join('\u0001');
}

function firstLine(error: unknown): string {
    return String(error instanceof Error ? error.message : error).split('\n')[0];
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

// Server ids (26-char), clock times and dates, scrubbed from any stored string for a deterministic trace.
const ID_RE = /(?<![a-z0-9])[a-z0-9]{26}(?![a-z0-9])/g;
const TIME_RE = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\b/g;

/**
 * Per-fixture token scrub so states from different fresh fixtures dedupe to the same key, and a
 * matching `sanitize` for arbitrary strings (pathnames, clause text) stored in the trace: it also
 * replaces 26-char server ids and clock times with placeholders.
 */
function fixtureNormalizer(
    fx: Fixture,
    origin: string,
): {normalize: (raw: string) => string; sanitize: (text: string) => string} {
    const replacements: Array<[string, string]> = [[origin, '<origin>']];
    for (const [key, ch] of Object.entries(fx.bindings.channel)) {
        replacements.push([ch.name, `<channel:${key}>`]);
    }
    for (const [id, actor] of Object.entries(fx.bindings.actor)) {
        replacements.push([actor.username, `<user:${id}>`]);
    }
    replacements.push([fx.bindings.team.name, '<team>']);
    replacements.push([fx.slug, '<slug>']);
    // Longest tokens first so e.g. team-<slug> is replaced before the bare slug.
    replacements.sort((a, b) => b[0].length - a[0].length);
    const substitute = (text: string) => {
        let out = text;
        for (const [from, to] of replacements) {
            if (from) {
                out = out.split(from).join(to);
            }
        }
        // Volatile sidebar badges: a channel link's accessible name gains " N mention(s)" / " unread"
        // when it has unseen posts. Scrubbing these generically (state key only; candidate names still
        // come from the raw snapshot) stops the same logical view from splitting into many states.
        out = out.replace(/ \d+ mentions?(?=["\n])/g, '').replace(/ unread(?=["\n])/g, '');
        // The account-menu presence indicator flips Offline -> Online as the WebSocket connects, which is
        // not part of the app state the journey explores.
        out = out.replace(/Status is "[^"]*"/g, 'Status is "<status>"');
        return out;
    };
    return {
        normalize: (raw: string) => normalizeSnapshot(substitute(raw)),
        sanitize: (text: string) => substitute(text).replace(ID_RE, '<id>').replace(TIME_RE, '<time>'),
    };
}

async function markDocument(page: Page) {
    await page.evaluate((key) => {
        (window as unknown as Record<string, boolean>)[key] = true;
    }, DOCUMENT_MARKER);
}

async function stillSameDocument(page: Page): Promise<boolean> {
    return page.evaluate((key) => (window as unknown as Record<string, boolean>)[key] === true, DOCUMENT_MARKER);
}

async function clickAction(page: Page, action: RoleName) {
    if (action.role === 'key' && action.name === 'Escape') {
        await page.keyboard.press('Escape');
        return;
    }
    const dialogs = page.getByRole('dialog');
    const scope = (await dialogs.count()) > 0 ? dialogs.last() : page;
    await scope.getByRole(action.role as 'button', {name: action.name, exact: true}).click();
}

/** Progress signal: fully-satisfied checkpoints (heavy), fired events, and satisfied partial clauses (tiny). */
function clauseProgress(rest: CheckpointResult[], ui: UiCheckpointResult[], traj: Trajectory): Progress {
    let fullCheckpoints = 0;
    let partialClauses = 0;
    for (const r of [...rest, ...ui]) {
        if (r.ok) {
            fullCheckpoints++;
        }
        partialClauses += r.clauses.filter((c) => c.ok).length;
    }
    return {
        fullCheckpoints,
        firedEvents: traj.eventFired.size,
        partialClauses,
    };
}

export async function runSearch(
    pw: PlaywrightExtended,
    charter: JourneyCharter,
    origin: string,
    options: SearchOptions = {},
): Promise<SearchResult> {
    const start = Date.now();
    const budget = charter.budget;
    const goalTerms = deriveGoalTerms(charter);
    const restCheckpoints = charter.checkpoints.filter((c) => c.kind === 'rest');
    const uiCheckpoints = charter.checkpoints.filter((c) => c.kind === 'ui');
    const events = charter.events;
    const successIds = (charter.success_criteria.qualifies_when.match(/[A-Z][A-Z0-9-]*[A-Z0-9]|[A-Z]/g) ?? []).filter(
        (id) => charter.checkpoints.some((c) => c.id === id),
    );

    // Outcome mode (success_criteria.outcomes): classification, append-only observations, confirmation, verdict.
    const outcomeRules = hasOutcomes(charter) ? validateOutcomeCharter(charter) : null;
    const ui = outcomeRules ? uiRules(charter) : null;
    const log = outcomeRules
        ? new ObservationLog(
              nodePath.join(options.outDir ?? outDir(), OBSERVATION_LOG_FILE),
              options.onObservationAppend,
          )
        : null;
    const clientConfigPath = clientConfigRequestPath(charter);
    const readBackIds = restCheckpoints
        .map((c) => c.id)
        .filter((id) =>
            new RegExp(`(?<![A-Za-z0-9_-])${escapeRe(id)}(?![A-Za-z0-9_-])`).test(charter.fixture.read_back ?? ''),
        );
    const reserved = outcomeRules?.reserved ?? 0;
    const stateRecords: StateRecord[] = [];
    const replayErrors: OutcomeResult['replayErrors'] = [];
    const timings: OutcomeResult['timings'] = [];
    const evidence: OutcomeResult['evidence'] = {};
    let setupFailure: OutcomeResult['setupFailure'] = null;
    let buildIdentity: Array<[string, string]> = [];
    let confirmationReplays = 0;
    let phase = '';

    const states: ObservedState[] = [];
    const byId = new Map<string, ObservedState>();
    const transitions: Transition[] = [];
    const budgetSkips: BudgetSkip[] = [];
    const seenPaths = new Set<string>();
    const guardViolations: string[] = [];
    const observations = new Set<string>();
    const checkpointProgressBest: Record<string, boolean> = {};
    const qualifyingPaths: Array<{path: RoleName[]; confirmed: boolean}> = [];

    let actions = 0;
    let replays = 0;
    let qualifyingReplays = 0;
    let stoppedReason = '';
    let serverPreconditions: string[] = [];
    let qualified: SearchResult['qualified'] = null;

    const frontier: Array<{
        path: RoleName[];
        parent: ObservedState;
        candidate: RoleName;
        score: ScoreComponents;
    }> = [];
    // Generic exploration term: each distinct (role, name) actuated anywhere lowers that control's priority,
    // so the search stops re-toggling one control across a modal's many combinations and tries fresh ones.
    const actuationCount = new Map<string, number>();
    const fatigueKey = (rn: RoleName) => `${rn.role}\u0000${rn.name}`;
    const fatigueOf = (rn: RoleName) => actuationCount.get(fatigueKey(rn)) ?? 0;

    function pushChildren(parent: ObservedState) {
        for (const candidate of parent.candidates) {
            const score = scoreChild(parent, candidate, goalTerms);
            frontier.push({
                path: [...parent.via, candidate],
                parent,
                candidate,
                score,
            });
        }
    }

    function selectBest(): number {
        let bestIdx = -1;
        let best: {
            eff: number;
            name: string;
            role: string;
            pathLen: number;
        } | null = null;
        for (let i = 0; i < frontier.length; i++) {
            const item = frontier[i];
            const eff = item.score.total - WEIGHTS.fatigue * fatigueOf(item.candidate);
            const key = {
                eff,
                name: item.candidate.name,
                role: item.candidate.role,
                pathLen: item.path.length,
            };
            if (
                !best ||
                key.eff > best.eff ||
                (key.eff === best.eff &&
                    (compareStrings(key.name, best.name) < 0 ||
                        (key.name === best.name &&
                            (compareStrings(key.role, best.role) < 0 ||
                                (key.role === best.role && key.pathLen < best.pathLen)))))
            ) {
                best = key;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    /** One fresh-fixture replay that walks `path` from the start, firing events and tracking checkpoints. */
    async function replay(path: RoleName[], kind: ReplayKind = 'expansion'): Promise<ReplayOutcome> {
        replays++;
        const replayId = `r${replays}`;
        if (kind === 'confirmation') {
            confirmationReplays++;
        }
        const t0 = Date.now();
        if (clientConfigPath) {
            phase = 'server preconditions';
            const pre = await checkClientConfigPreconditions(charter, origin, clientConfigPath);
            serverPreconditions = pre.report;
            buildIdentity = pre.buildIdentity;
        }
        phase = 'fixture';
        const fx = await createFixture(pw, charter);
        if (!clientConfigPath) {
            phase = 'server preconditions';
            serverPreconditions = await checkServerPreconditions(charter, fx.adminClient);
        }
        phase = 'read-back';
        await readBack(charter, fx);
        const secrets = [
            fx.slug,
            ...Object.values(fx.bindings.actor).map((a) => a.password),
            fx.adminClient.getToken(),
            ...Object.values(fx.actorClients).map((c) => c.getToken()),
        ];
        const stepClasses: Array<string | null> = [];
        const logReadBack = async (when: 'read-back' | 'end-of-replay read-back') => {
            phase = when;
            for (const id of readBackIds) {
                const r = await evalRestCheckpoint(
                    pw,
                    charter,
                    restCheckpoints.find((c) => c.id === id)!,
                    fx,
                );
                log?.append(
                    {
                        kind: 'read_back',
                        phase: when,
                        replay: replayId,
                        replay_kind: kind,
                        fixture: '<slug>',
                        checkpoint: id,
                        result: r.ok,
                        clauses: r.clauses.map((c) => ({desc: sanitize(c.desc), ok: c.ok})),
                    },
                    secrets,
                );
                if (!r.ok) {
                    throw new SetupFailure(`${when}: checkpoint ${id} does not hold`);
                }
            }
        };
        const {normalize, sanitize} = fixtureNormalizer(fx, origin);
        await logReadBack('read-back');
        phase = 'session';
        const tFixture = Date.now();
        if (process.env.JOURNEY_TIMING) {
            // eslint-disable-next-line no-console
            console.log(`[timing] fixture+readback ${tFixture - t0}ms for depth ${path.length}`);
        }
        const bindings: Bindings = fx.bindings;

        const traj: Trajectory = {
            everTrue: new Map(),
            everTrueAfterEvent: new Map(),
            eventFired: new Set(),
            eventStep: {},
            eventFiringLog: [],
            becameTrue: [],
            c3RowTextExposed: null,
            stepPathnames: [],
            stepStateIds: [],
            c1AtEnd: false,
            qualifies: false,
        };

        const session = await openGuardedSessionAs(
            pw,
            {
                id: bindings.actor[charter.start.actor].id,
                username: bindings.actor[charter.start.actor].username,
                password: bindings.actor[charter.start.actor].password,
            },
            'exploration',
        );
        const page = session.page;
        let terminal: ObservedState | null = null;

        try {
            const startPath = resolveTemplate(charter.start.start_path, bindings);
            await page.goto(startPath);
            const tNav0 = Date.now();
            await journeySettle(page, normalize);
            await markDocument(page);
            if (process.env.JOURNEY_TIMING) {
                // eslint-disable-next-line no-console
                console.log(
                    `[timing] login+goto+settle(start) ${Date.now() - tFixture}ms (settle ${Date.now() - tNav0}ms)`,
                );
            }

            // Cheap per-step tracking: evaluate checkpoints, fire events, track UI checkpoints. No candidate
            // enumeration (that happens only at the terminal state), to keep replays fast.
            const trackState = async (
                depth: number,
            ): Promise<{
                observed: Observed;
                restResults: CheckpointResult[];
                uiResults: UiCheckpointResult[];
                report: ThreadsReport | null;
            }> => {
                const tSettle = Date.now();
                const observed = await journeySettle(page, normalize);
                const raw = observed.raw;
                const pathname = observed.pathname;
                if (process.env.JOURNEY_TIMING) {
                    // eslint-disable-next-line no-console
                    console.log(`[timing]   settle ${Date.now() - tSettle}ms @ ${pathname}`);
                }

                const tRest = Date.now();
                const restResults: CheckpointResult[] = [];
                const evalRest = async () => {
                    for (let i = 0; i < restCheckpoints.length; i++) {
                        const result = await evalRestCheckpoint(pw, charter, restCheckpoints[i], fx);
                        restResults[i] = result;
                        if (result.ok && !traj.everTrue.get(restCheckpoints[i].id)) {
                            traj.everTrue.set(restCheckpoints[i].id, true);
                            traj.becameTrue.push(restCheckpoints[i].id);
                        }
                    }
                };
                await evalRest();

                // Event triggers: fire at most once, when the trigger checkpoint first holds.
                for (const event of events) {
                    const trigger = (event.trigger as {checkpoint: string}).checkpoint;
                    if (traj.eventFired.has(event.id)) {
                        continue;
                    }
                    let triggerOk = traj.everTrue.get(trigger) === true;
                    if (!triggerOk) {
                        const cp = restCheckpoints.find((c) => c.id === trigger);
                        if (cp) {
                            const deadline = Date.now() + TRIGGER_WAIT_MS;
                            while (!triggerOk && Date.now() < deadline) {
                                await sleep(POLL_INTERVAL_MS);
                                const r = await evalRestCheckpoint(pw, charter, cp, fx);
                                if (r.ok) {
                                    triggerOk = true;
                                    traj.everTrue.set(trigger, true);
                                    traj.becameTrue.push(trigger);
                                    restResults[restCheckpoints.indexOf(cp)] = r;
                                }
                            }
                        }
                    }
                    if (triggerOk) {
                        await fireEvent(pw, charter, event, fx);
                        traj.eventFired.add(event.id);
                        traj.eventStep[event.id] = depth;
                        traj.eventFiringLog.push(
                            `${event.id} fired after ${trigger} (teammate event over REST by ${String(event.actor)}'s client, not through the UI)`,
                        );
                        const resultCp = restCheckpoints.find((c) => c.id === (event.result_checkpoint as string));
                        if (resultCp) {
                            const deadline = Date.now() + RESULT_WAIT_MS;
                            let ok = false;
                            while (!ok && Date.now() < deadline) {
                                const r = await evalRestCheckpoint(pw, charter, resultCp, fx);
                                if (r.ok) {
                                    ok = true;
                                    traj.everTrue.set(resultCp.id, true);
                                    traj.becameTrue.push(resultCp.id);
                                    restResults[restCheckpoints.indexOf(resultCp)] = r;
                                } else {
                                    await sleep(POLL_INTERVAL_MS);
                                }
                            }
                        }
                        // Re-evaluate all REST checkpoints now that the event posts exist, so a checkpoint
                        // that only becomes true post-event (e.g. FINAL) is observed in this same step. This
                        // lets the post-commit state carry its final trajectory signature immediately, so a
                        // later return to it dedupes and any detour collapses to the minimal path.
                        await evalRest();
                    }
                }

                const uiResults: UiCheckpointResult[] = [];
                let uiObservations: UiObservation[] = [];
                if (ui) {
                    const values: Record<string, boolean | undefined> = {};
                    restCheckpoints.forEach((c, i) => {
                        values[c.id] = restResults[i]?.ok;
                    });
                    uiObservations = await observeUi(page, charter, ui, bindings, pathname, raw, values);
                    for (const o of uiObservations) {
                        const r: UiCheckpointResult = {
                            id: o.id,
                            ok: o.ok === true,
                            clauses: o.clauses.map((c) => ({desc: c.desc, ok: c.ok})),
                            observation: o.clauses
                                .filter((c) => c.string !== undefined)
                                .map((c) => `${o.id} "${c.string}" via ${c.method}`),
                        };
                        uiResults.push(r);
                        r.observation.forEach((x) => observations.add(x));
                        if (r.ok && !traj.everTrue.get(o.id)) {
                            traj.everTrue.set(o.id, true);
                            traj.becameTrue.push(o.id);
                        }
                        if (r.ok && traj.eventFired.size > 0) {
                            traj.everTrueAfterEvent.set(o.id, true);
                        }
                    }
                } else {
                    for (const cp of uiCheckpoints) {
                        const r = await evalUiCheckpoint(page, charter, cp, bindings, raw, pathname);
                        uiResults.push(r);
                        r.observation.forEach((o) => observations.add(o));
                        if (r.ok && !traj.everTrue.get(cp.id)) {
                            traj.everTrue.set(cp.id, true);
                            traj.becameTrue.push(cp.id);
                        }
                        if (r.ok && traj.eventFired.size > 0) {
                            traj.everTrueAfterEvent.set(cp.id, true);
                        }
                    }
                }

                if (process.env.JOURNEY_TIMING) {
                    // eslint-disable-next-line no-console
                    console.log(`[timing]   checkpoints+events ${Date.now() - tRest}ms`);
                }
                const report = threadsReport(raw, pathname, bindings, charter);
                if (report && report.snapshotExposesRowText !== null) {
                    traj.c3RowTextExposed = report.snapshotExposesRowText;
                }
                traj.stepPathnames[depth] = sanitize(pathname);
                const trajSig = `cp:${[...traj.everTrue.entries()]
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                    .sort()
                    .join(',')}|ev:${[...traj.eventFired].sort().join(',')}`;
                traj.stepStateIds[depth] = stateKey(`${sanitize(pathname)}#${trajSig}`, observed.normalized);
                if (outcomeRules && log) {
                    recordState(depth, sanitize(pathname), restResults, uiObservations);
                }
                return {observed, restResults, uiResults, report};
            };

            /** Appends this state's checkpoint evaluations and classification to the observation log. */
            const recordState = (
                depth: number,
                urlPath: string,
                restResults: CheckpointResult[],
                uiObservations: UiObservation[],
            ) => {
                const values: Record<string, boolean | null> = {};
                for (const r of restResults) {
                    values[r.id] = r.ok;
                }
                for (const o of uiObservations) {
                    values[o.id] = o.ok;
                }
                const {cls, matched} = classify(
                    outcomeRules!,
                    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? undefined])),
                );
                stepClasses[depth] = cls;
                const stepPath = path.slice(0, depth);
                const context = {
                    replay: replayId,
                    replay_kind: kind,
                    fixture: '<slug>',
                    state: traj.stepStateIds[depth],
                    depth,
                    url_path: urlPath,
                    path: stepPath,
                };
                for (const r of restResults) {
                    log!.append(
                        {
                            kind: 'checkpoint',
                            ...context,
                            checkpoint: r.id,
                            checkpoint_kind: 'rest',
                            evaluated: true,
                            result: r.ok,
                            clauses: r.clauses.map((c) => ({desc: sanitize(c.desc), ok: c.ok})),
                            classification: cls,
                        },
                        secrets,
                    );
                }
                for (const o of uiObservations) {
                    const entry = log!.append(
                        {
                            kind: 'checkpoint',
                            ...context,
                            checkpoint: o.id,
                            checkpoint_kind: 'ui',
                            evaluated: o.evaluated,
                            gate: o.gate,
                            result: o.ok,
                            clauses: o.clauses.map((c) => ({...c, desc: sanitize(c.desc)})),
                            scope: o.scope,
                            settle: o.settle,
                            classification: cls,
                        },
                        secrets,
                    );
                    timings.push({seq: entry.seq, checkpoint: o.id, settle_ms_used: o.settleMsUsed});
                    for (const c of o.clauses) {
                        if (c.string !== undefined) {
                            evidence[c.string] ??= {snapshot: 0, dom: 0, none: 0};
                            evidence[c.string][c.method ?? 'none']++;
                        }
                    }
                }
                const stateEntry = log!.append(
                    {
                        kind: 'state',
                        ...context,
                        results: values,
                        classification: cls,
                        matched_classes: matched,
                    },
                    secrets,
                );
                stateRecords.push({
                    seq: stateEntry.seq,
                    replay: replayId,
                    replayKind: kind,
                    stateKey: traj.stepStateIds[depth],
                    urlPath,
                    path: stepPath,
                    pathKey: pathKeyOf(stepPath),
                    cls,
                    matched,
                    results: values,
                });
            };

            // Terminal observation: build the full ObservedState, with candidate enumeration.
            const observeTerminal = async (depth: number, via: RoleName[]): Promise<ObservedState> => {
                const {observed, restResults, uiResults, report} = await trackState(depth);
                const raw = observed.raw;
                const pathname = observed.pathname;
                const tEnum = Date.now();
                const enumeration = await enumerateCandidates(page, raw, charter);
                // Drop candidates whose accessible name embeds a fixture-specific token (slug, team/channel
                // name, username). They cannot be replayed on a fresh fixture, so they are not valid actions.
                const stableCandidates: RoleName[] = [];
                const volatileSkips: typeof enumeration.skipped = [];
                for (const c of enumeration.candidates) {
                    if (sanitize(c.name) === c.name) {
                        stableCandidates.push(c);
                    } else {
                        volatileSkips.push({
                            ...c,
                            reason: 'volatile name (fixture-specific token)',
                        });
                    }
                }
                enumeration.candidates = stableCandidates;
                enumeration.skipped = [...enumeration.skipped, ...volatileSkips];
                if (process.env.JOURNEY_TIMING) {
                    // eslint-disable-next-line no-console
                    console.log(
                        `[timing] enumerate(depth ${depth}) ${Date.now() - tEnum}ms, ${enumeration.candidates.length} candidates`,
                    );
                }
                // The key uses the slug-substituted pathname (so fresh fixtures dedup) PLUS a trajectory
                // signature of which checkpoints/events have fired (computed in trackState). A server-side
                // change like saving the preference (C1) or the teammate event (C2) does not alter the channel
                // snapshot, so without the signature the post-change state would collapse into the pre-change one.
                const id = traj.stepStateIds[depth];
                if (process.env.JOURNEY_DEBUG) {
                    const fs = await import('node:fs');
                    fs.mkdirSync('/tmp/af/states', {recursive: true});
                    fs.writeFileSync(
                        `/tmp/af/states/${id}_d${depth}.txt`,
                        `PATH ${via.map((a) => a.name).join(' | ')}\nCANDIDATES ${enumeration.candidates.map((c) => c.role + ':' + c.name).join(' ; ')}\n\n${observed.normalized}`,
                    );
                }
                const progress = clauseProgress(restResults, uiResults, traj);
                const novelty = byId.has(id) ? 0 : 1;
                for (const id2 of [...traj.everTrue.keys()]) {
                    checkpointProgressBest[id2] = checkpointProgressBest[id2] || traj.everTrue.get(id2) === true;
                }
                const sanitizeCp = <T extends CheckpointResult | UiCheckpointResult>(r: T): T => ({
                    ...r,
                    clauses: r.clauses.map((c) => ({
                        ...c,
                        desc: sanitize(c.desc),
                    })),
                });
                const sanitizedReport = report
                    ? {
                          ...report,
                          pathname: sanitize(report.pathname),
                          tabs: report.tabs.map(sanitize),
                          tabpanelLinks: report.tabpanelLinks.map(sanitize),
                          headings: report.headings.map(sanitize),
                      }
                    : null;
                return {
                    id,
                    pathname: sanitize(pathname),
                    depth,
                    via,
                    viaTransitions: [],
                    novelty,
                    progress,
                    containerOpen: enumeration.modalOpen || enumeration.menuOpen,
                    candidates: enumeration.candidates,
                    skipped: enumeration.skipped.map((s) => ({
                        ...s,
                        name: sanitize(s.name),
                        reason: sanitize(s.reason),
                    })),
                    regions: enumeration.regions,
                    unidentifiedLandmarks: enumeration.unidentifiedLandmarks.map(sanitize),
                    restResults: restResults.map(sanitizeCp),
                    uiResults: uiResults.map(sanitizeCp),
                    threadsReport: sanitizedReport,
                    sameDocument: await stillSameDocument(page),
                };
            };

            if (path.length === 0) {
                terminal = await observeTerminal(0, []);
            } else {
                for (let i = 0; i < path.length - 1; i++) {
                    const tc = Date.now();
                    await clickAction(page, path[i]);
                    await trackState(i + 1);
                    if (process.env.JOURNEY_TIMING) {
                        // eslint-disable-next-line no-console
                        console.log(`[timing] step ${i + 1} click+track ${Date.now() - tc}ms`);
                    }
                }
                const tLast = Date.now();
                await clickAction(page, path[path.length - 1]);
                if (process.env.JOURNEY_TIMING) {
                    // eslint-disable-next-line no-console
                    console.log(`[timing] terminal click ${Date.now() - tLast}ms`);
                }
                terminal = await observeTerminal(path.length, path);
                if (process.env.JOURNEY_TIMING) {
                    // eslint-disable-next-line no-console
                    console.log(`[timing] terminal step click+observe ${Date.now() - tLast}ms`);
                }
            }

            // Re-poll C1-style trigger checkpoints to confirm they still hold at the end.
            traj.c1AtEnd = true;
            for (const event of events) {
                const trigger = (event.trigger as {checkpoint: string}).checkpoint;
                const cp = restCheckpoints.find((c) => c.id === trigger);
                if (cp && traj.everTrue.get(trigger)) {
                    const r = await evalRestCheckpoint(pw, charter, cp, fx);
                    traj.c1AtEnd = traj.c1AtEnd && r.ok;
                }
            }

            traj.qualifies =
                traj.c1AtEnd &&
                successIds.every((id) => {
                    if (uiCheckpoints.some((c) => c.id === id)) {
                        return traj.everTrueAfterEvent.get(id) === true;
                    }
                    return traj.everTrue.get(id) === true;
                });

            await logReadBack('end-of-replay read-back');
            phase = 'session';

            guardViolations.push(...session.ledger.violations);
            return {
                terminal: terminal!,
                trajectory: traj,
                guardViolations: session.ledger.violations,
                replayId,
                stepClasses,
            };
        } finally {
            await closeGuardedSession(session).catch((e) => guardViolations.push(String(e)));
        }
    }

    /** Appends a run-level event; a message that cannot be sanitized is withheld rather than written. */
    function logEvent(entry: Record<string, unknown> & {kind: string}) {
        try {
            log!.append(entry);
        } catch {
            log!.append({...entry, message: 'message withheld (could not be sanitized)'});
        }
    }

    /** Outcome mode: an error in a setup phase is a setup failure; any other replay error is recorded, not thrown. */
    async function attempt(p: RoleName[], kind: ReplayKind): Promise<ReplayOutcome | null> {
        if (!outcomeRules) {
            return replay(p, kind);
        }
        try {
            return await replay(p, kind);
        } catch (error) {
            if (error instanceof CharterRuleError) {
                throw error;
            }
            const message = firstLine(error);
            const replayId = `r${replays}`;
            if (error instanceof SetupFailure || SETUP_PHASES.has(phase)) {
                setupFailure = {phase, message, replay: replayId};
                logEvent({kind: 'setup_failure', replay: replayId, replay_kind: kind, phase, message});
            } else {
                replayErrors.push({replay: replayId, path: p, message});
                logEvent({kind: 'replay_error', replay: replayId, replay_kind: kind, path: p, phase, message});
            }
            return null;
        }
    }

    // --- Start state ---
    const first = await attempt([], 'start');
    if (first) {
        const s0 = first.terminal;
        states.push(s0);
        byId.set(s0.id, s0);
        pushChildren(s0);
    }

    const budgetLeft = () => {
        const elapsed = (Date.now() - start) / 1000;
        // Outcome mode holds back wall clock for the reserved confirmation replays at the mean replay cost so far.
        const reserveSeconds = reserved > 0 && replays > 0 ? (reserved * elapsed) / replays : 0;
        if (elapsed >= budget.wall_clock_seconds - reserveSeconds) {
            return 'wall clock';
        }
        if (actions >= budget.max_actions) {
            return 'max actions';
        }
        if (replays >= budget.max_replays - reserved) {
            return reserved > 0 ? 'max replays (confirmation reserve held)' : 'max replays';
        }
        return '';
    };
    const decisiveSeen = () => stateRecords.some((s) => s.cls !== null && outcomeRules!.confirmOrder.includes(s.cls));

    while (frontier.length > 0 && !setupFailure) {
        if (outcomeRules && !outcomeRules.noEarlyStop && decisiveSeen()) {
            stoppedReason = 'first classification that needs confirmation (the charter declares no no_early_stop)';
            break;
        }
        const limit = budgetLeft();
        if (limit) {
            stoppedReason = `budget exhausted (${limit})`;
            for (const item of frontier) {
                budgetSkips.push({
                    from: item.parent.id,
                    action: item.candidate,
                    reason: `budget (${limit})`,
                });
            }
            break;
        }
        const bestIdx = selectBest();
        const item = frontier.splice(bestIdx, 1)[0];
        const pathKey = item.path.map((a) => `${a.role}\u0000${a.name}`).join('\u0001');
        if (seenPaths.has(pathKey)) {
            continue;
        }
        seenPaths.add(pathKey);
        if (item.path.length > budget.max_depth) {
            budgetSkips.push({
                from: item.parent.id,
                action: item.candidate,
                reason: 'max depth',
            });
            continue;
        }

        actuationCount.set(fatigueKey(item.candidate), fatigueOf(item.candidate) + 1);
        actions++;
        const outcome = await attempt(item.path, 'expansion');
        if (!outcome) {
            if (setupFailure) {
                stoppedReason = 'setup failure';
                break;
            }
            continue;
        }
        const s = outcome.terminal;
        // eslint-disable-next-line no-console
        console.log(
            `[journey] #${actions} r${replays} depth ${item.path.length} score ${item.score.total} click ${describe(item.candidate)} -> ${s.pathname} (${byId.has(s.id) ? 'dedup' : 'new'})${outcome.trajectory.becameTrue.length ? ' cp+' + outcome.trajectory.becameTrue.join(',') : ''}${outcome.trajectory.qualifies ? ' QUALIFIES' : ''}`,
        );
        const existing = byId.get(s.id);
        const n = actions;
        const transition: Transition = {
            n,
            from: item.parent.id,
            action: item.candidate,
            to: s.id,
            score: item.score,
            outcome: existing ? 'revisit (deduped)' : 'new state',
            changes: [],
            sameDocument: s.sameDocument,
            checkpointsBecameTrue: outcome.trajectory.becameTrue,
            eventFirings: outcome.trajectory.eventFiringLog,
        };
        transitions.push(transition);

        if (!outcomeRules && outcome.trajectory.qualifies) {
            qualifyingReplays++;
            // Collapse any cycle (a sub-walk returning to the same state adds no actions) to the minimal path.
            const collapsed = collapsePath(item.path, outcome.trajectory.stepStateIds);
            // Confirmation replay of the (collapsed) path on a brand-new fixture.
            let confirmed = false;
            let confirmTraj = outcome.trajectory;
            if (!budgetLeft()) {
                qualifyingReplays++;
                const conf = await replay(collapsed);
                confirmed = conf.trajectory.qualifies;
                confirmTraj = conf.trajectory;
            }
            qualifyingPaths.push({path: collapsed, confirmed});
            if (confirmed) {
                qualified = {
                    path: collapsed,
                    eventStep: {...confirmTraj.eventStep},
                    stepPathnames: [...confirmTraj.stepPathnames],
                    c3SnapshotExposesRowText: confirmTraj.c3RowTextExposed,
                    uiObservations: [...observations].sort(),
                };
                stoppedReason = 'qualifying path confirmed on a fresh fixture';
                break;
            }
        }

        if (existing) {
            continue;
        }
        s.viaTransitions = [...item.parent.viaTransitions, n];
        states.push(s);
        byId.set(s.id, s);

        // path_scope_rule: a state that left the /<team>/ prefix is recorded but not expanded.
        const leftTeam = !/^\/<team>\//.test(s.pathname);
        if (leftTeam) {
            continue;
        }
        if (states.length >= budget.max_states) {
            budgetSkips.push({
                from: s.id,
                action: {role: 'n/a', name: 'children'},
                reason: 'max states',
            });
            continue;
        }
        if (s.depth >= budget.max_depth) {
            continue;
        }
        pushChildren(s);
    }

    if (setupFailure && !stoppedReason) {
        stoppedReason = 'setup failure';
    }
    if (!stoppedReason) {
        stoppedReason = frontier.length === 0 ? 'frontier exhausted' : stoppedReason;
    }

    // Selection among qualifying paths: fewest actions, then lexicographically smallest sequence.
    // Selection among confirmed qualifying paths: fewest actions, then lexicographically smallest.
    const confirmedPaths = qualifyingPaths.filter((q) => q.confirmed);
    if (confirmedPaths.length > 1 && qualified) {
        confirmedPaths.sort((a, b) => a.path.length - b.path.length || compareSequence(a.path, b.path));
        qualified = {...qualified, path: confirmedPaths[0].path};
    }

    let outcomes: OutcomeResult | undefined;
    if (outcomeRules && log) {
        outcomes = await confirmAndDecide();
    }

    /**
     * Confirmation replays on fresh fixtures for every distinct (classification, path) that needs one, in the
     * charter's confirmation order, then fewest actions, then lexicographic. New pairs that confirmation replays
     * observe are confirmed too while budget remains. Then the verdict, by the charter's precedence.
     */
    async function confirmAndDecide(): Promise<OutcomeResult> {
        const rules = outcomeRules!;
        const confirmations: ConfirmationRecord[] = [];
        const attempted = new Set<string>();
        while (!setupFailure) {
            const pending = new Map<string, StateRecord>();
            for (const s of stateRecords) {
                if (s.cls !== null && rules.confirmOrder.includes(s.cls)) {
                    const key = confirmationKey(s.cls, s.pathKey);
                    if (!attempted.has(key) && !pending.has(key)) {
                        pending.set(key, s);
                    }
                }
            }
            if (pending.size === 0) {
                break;
            }
            const next = [...pending.values()].sort(
                (a, b) =>
                    rules.confirmOrder.indexOf(a.cls!) - rules.confirmOrder.indexOf(b.cls!) ||
                    a.path.length - b.path.length ||
                    compareSequence(a.path, b.path),
            )[0];
            const key = confirmationKey(next.cls!, next.pathKey);
            attempted.add(key);
            const record: ConfirmationRecord = {
                cls: next.cls!,
                path: next.path,
                pathKey: next.pathKey,
                attempted: false,
                confirmed: false,
                replay: null,
                reachedClass: null,
                reason: '',
            };
            const wallClockOut = (Date.now() - start) / 1000 >= budget.wall_clock_seconds;
            if (replays >= budget.max_replays || wallClockOut) {
                record.reason = `not attempted: budget (${wallClockOut ? 'wall clock' : 'max replays'})`;
            } else {
                const conf = await attempt(next.path, 'confirmation');
                record.attempted = true;
                record.replay = conf?.replayId ?? `r${replays}`;
                if (conf) {
                    record.reachedClass = conf.stepClasses[next.path.length] ?? null;
                    record.confirmed = record.reachedClass === next.cls;
                    record.reason = record.confirmed
                        ? 'a fresh-fixture replay of the path reached the same classification'
                        : 'a fresh-fixture replay of the path reached a different classification';
                } else {
                    record.reason = setupFailure
                        ? 'confirmation replay hit a setup failure'
                        : 'confirmation replay error';
                }
            }
            confirmations.push(record);
            logEvent({
                kind: 'confirmation',
                classification: record.cls,
                path: record.path,
                attempted: record.attempted,
                confirmed: record.confirmed,
                replay: record.replay,
                reached_classification: record.reachedClass,
                note: record.reason,
            });
        }
        const decided = decideVerdict(rules, {
            setupFailed: setupFailure !== null,
            classified: stateRecords.filter((s) => s.cls !== null).map((s) => ({pathKey: s.pathKey, cls: s.cls!})),
            confirmations: new Map(
                confirmations.filter((c) => c.attempted).map((c) => [confirmationKey(c.cls, c.pathKey), c.confirmed]),
            ),
        });
        logEvent({kind: 'verdict', verdict: decided.verdict, precedence_entry: decided.rule});
        const entries: LogEntry[] = log!.all();
        return {
            verdict: decided.verdict,
            verdictRule: decided.rule,
            setupFailure,
            serverPreconditions,
            buildIdentity,
            states: stateRecords,
            confirmations,
            preserveClasses: rules.preserveClasses,
            confirmOrder: rules.confirmOrder,
            classNames: rules.classes.map((c) => c.name),
            evidence: Object.fromEntries(Object.entries(evidence).sort(([a], [b]) => compareStrings(a, b))),
            replayErrors,
            reserve: {reserved, confirmationReplays, expansionReplays: replays - confirmationReplays},
            log: entries,
            timings,
        };
    }

    const deepest = states.reduce((m, s) => Math.max(m, s.depth), 0);
    return {
        goalTerms: [...goalTerms].sort(compareStrings),
        states,
        transitions,
        budgetSkips,
        counters: {
            actions,
            replays,
            states: states.length,
            deepest,
            qualifyingReplays,
        },
        qualified,
        qualifyingPaths,
        serverPreconditions,
        guardViolations,
        stoppedReason,
        bestFrontier: [...frontier]
            .map((f) => ({
                f,
                eff: f.score.total - WEIGHTS.fatigue * fatigueOf(f.candidate),
            }))
            .sort((a, b) => b.eff - a.eff)
            .slice(0, 12)
            .map(({f, eff}) => ({
                path: [...f.path].map(describe).join(' > '),
                score: eff,
            })),
        wallClockSeconds: Math.round((Date.now() - start) / 1000),
        checkpointProgressBest,
        observations: [...observations].sort(),
        ...(outcomes ? {outcomes} : {}),
    };
}

/**
 * Removes cycles from a discovered path: if the same state recurs (stepStateIds[i] === stepStateIds[j], i<j),
 * the actions between them form a loop that reaches no new state, so they are dropped. Yields the minimal walk.
 */
function collapsePath(path: RoleName[], stepStateIds: string[]): RoleName[] {
    const p = [...path];
    const s = [...stepStateIds];
    for (;;) {
        let collapsed = false;
        for (let j = 1; j < s.length && !collapsed; j++) {
            for (let i = 0; i < j; i++) {
                if (s[i] !== undefined && s[i] === s[j]) {
                    p.splice(i, j - i);
                    s.splice(i + 1, j - i);
                    collapsed = true;
                    break;
                }
            }
        }
        if (!collapsed) {
            return p;
        }
    }
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
