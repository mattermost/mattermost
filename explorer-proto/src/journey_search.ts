// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import type {Observed} from './bfs.ts';
import {resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyCharter} from './journey_charter.ts';
import {enumerateCandidates, ESCAPE} from './journey_actions.ts';
import type {SkippedCandidate} from './journey_actions.ts';
import {checkServerPreconditions, createFixture, readBack} from './journey_fixture.ts';
import type {Fixture} from './journey_fixture.ts';
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
};

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
};

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
): Promise<SearchResult> {
    const start = Date.now();
    const budget = charter.budget;
    const goalTerms = deriveGoalTerms(charter);
    const restCheckpoints = charter.checkpoints.filter((c) => c.kind === 'rest');
    const uiCheckpoints = charter.checkpoints.filter((c) => c.kind === 'ui');
    const events = charter.events;
    const successIds = (charter.success_criteria.qualifies_when.match(/[A-Z][A-Z0-9]*/g) ?? []).filter((id) =>
        charter.checkpoints.some((c) => c.id === id),
    );

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
    async function replay(path: RoleName[]): Promise<ReplayOutcome> {
        replays++;
        const t0 = Date.now();
        const fx = await createFixture(pw, charter);
        serverPreconditions = await checkServerPreconditions(charter, fx.adminClient);
        await readBack(charter, fx);
        const tFixture = Date.now();
        if (process.env.JOURNEY_TIMING) {
            // eslint-disable-next-line no-console
            console.log(`[timing] fixture+readback ${tFixture - t0}ms for depth ${path.length}`);
        }
        const {normalize, sanitize} = fixtureNormalizer(fx, origin);
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
                return {observed, restResults, uiResults, report};
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

            guardViolations.push(...session.ledger.violations);
            return {
                terminal: terminal!,
                trajectory: traj,
                guardViolations: session.ledger.violations,
            };
        } finally {
            await closeGuardedSession(session).catch((e) => guardViolations.push(String(e)));
        }
    }

    // --- Start state ---
    const first = await replay([]);
    const s0 = first.terminal;
    states.push(s0);
    byId.set(s0.id, s0);
    pushChildren(s0);

    const budgetLeft = () => {
        if ((Date.now() - start) / 1000 >= budget.wall_clock_seconds) {
            return 'wall clock';
        }
        if (actions >= budget.max_actions) {
            return 'max actions';
        }
        if (replays >= budget.max_replays) {
            return 'max replays';
        }
        return '';
    };

    while (frontier.length > 0) {
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
        const outcome = await replay(item.path);
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

        if (outcome.trajectory.qualifies) {
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
