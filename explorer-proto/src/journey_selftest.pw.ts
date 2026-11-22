// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {expect, test} from '@playwright/test';
import type {Browser} from '@playwright/test';
import {Client4} from '@mattermost/client';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {engineHash, engineHashFiles} from './engine_hash.ts';
import {deepEqual, readPath, resolveDeep} from './journey_charter.ts';
import type {Bindings, JourneyCharter} from './journey_charter.ts';
import {clientConfigRequestPath} from './journey_fixture.ts';
import {OBSERVATION_LOG_FILE, ObservationLog} from './journey_observations.ts';
import {
    CharterRuleError,
    classify,
    confirmationKey,
    decideVerdict,
    hasOutcomes,
    parseOutcomeRules,
    validateOutcomeCharter,
} from './journey_outcomes.ts';
import {runSearch} from './journey_search.ts';
import type {ObservedState, SearchResult} from './journey_search.ts';
import {SelftestApp} from './journey_selftest_app.ts';
import type {AppVariant} from './journey_selftest_app.ts';
import {journeyTraceJson, renderJourneyTrace, writeJourneyTrace} from './journey_trace.ts';
import {SESSIONS_DIR, SRC_DIR} from './paths.ts';
import {closeGuardedSessions} from './session.ts';

// Offline selftest for outcome mode. Every charter here is synthetic (journey_selftest_charter.json and copies
// of it); the app is journey_selftest_app.ts on loopback. The real fixture factory, REST evaluator, guard,
// search, UI evaluator, observation log and report run unmodified against it.

const PORT = Number(process.env.EXPLORER_SELFTEST_PORT);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const app = new SelftestApp();
const outputs: string[] = [];

test.beforeAll(async () => {
    if (!PORT || process.env.PW_BASE_URL !== ORIGIN) {
        throw new Error('journey_selftest.pw.ts runs only through `cli.ts journey-selftest`.');
    }
    await app.listen(PORT);
});
test.afterAll(async () => {
    await app.close();
});
test.afterEach(closeGuardedSessions);

function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function baseCharter(): JourneyCharter {
    return JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'journey_selftest_charter.json'), 'utf-8')) as JourneyCharter;
}

function ui(charter: JourneyCharter, id: string): Record<string, unknown> {
    return charter.checkpoints.find((c) => c.id === id)!.predicate as Record<string, unknown>;
}

function fakePw(browser: Browser): PlaywrightExtended {
    const login = async (username: string, password: string) => {
        const client = new Client4();
        client.setUrl(ORIGIN);
        const user = await client.login(username, password);
        return {client, user};
    };
    return {
        // 7 characters with letters outside [a-f], so a slug never looks like part of a hex digest.
        random: {id: () => `q${crypto.randomBytes(3).toString('hex').slice(0, 5)}z`},
        newTestPassword: () => `Sx-${crypto.randomBytes(8).toString('hex')}-1a`,
        getAdminClient: async () => {
            const {client, user} = await login(app.adminCredentials.username, app.adminCredentials.password);
            return {adminClient: client, adminUser: user};
        },
        makeClient: async ({username, password}: {username: string; password: string}) => login(username, password),
        testBrowser: {browser},
    } as unknown as PlaywrightExtended;
}

type Scenario = {
    result: SearchResult;
    report: Record<string, any>;
    log: Array<Record<string, any>>;
    dir: string;
    appendViolations: string[];
    appendChecks: number;
};

async function runScenario(
    browser: Browser,
    name: string,
    variant: AppVariant,
    mutate: (c: JourneyCharter) => void = () => undefined,
): Promise<Scenario> {
    app.reset(variant);
    const charter = baseCharter();
    mutate(charter);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `journey-selftest-${name}-`));
    outputs.push(dir);
    // (vii) after every append the earlier bytes are unchanged and the new line chains to their hash.
    let previous = '';
    let appendChecks = 0;
    const appendViolations: string[] = [];
    const onObservationAppend = (file: string) => {
        const now = fs.readFileSync(file, 'utf-8');
        if (!now.startsWith(previous) || sha256(now.slice(0, previous.length)) !== sha256(previous)) {
            appendViolations.push(`prefix changed before entry ${appendChecks + 1}`);
        }
        const lines = now.trimEnd().split('\n');
        const last = JSON.parse(lines[lines.length - 1]) as {prev_sha256: string; seq: number};
        if (last.prev_sha256 !== sha256(now.slice(0, now.length - lines[lines.length - 1].length - 1))) {
            appendViolations.push(`entry ${last.seq} does not chain to the bytes before it`);
        }
        if (last.seq !== lines.length) {
            appendViolations.push(`entry ${last.seq} is line ${lines.length}`);
        }
        previous = now;
        appendChecks++;
    };
    const result = await runSearch(fakePw(browser), charter, ORIGIN, {outDir: dir, onObservationAppend});
    writeJourneyTrace(dir, charter, result);
    const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf-8')) as Record<string, any>;
    const log = fs
        .readFileSync(path.join(dir, OBSERVATION_LOG_FILE), 'utf-8')
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, any>);
    return {result, report, log, dir, appendViolations, appendChecks};
}

function statesOf(s: Scenario, cls: string) {
    return s.log.filter((e) => e.kind === 'state' && e.classification === cls);
}

function expectSanitized(dir: string) {
    for (const file of fs.readdirSync(dir)) {
        const text = fs.readFileSync(path.join(dir, file), 'utf-8');
        expect(text.includes('127.0.0.1'), `${file} holds the loopback host`).toBe(false);
        expect(text.includes(`:${PORT}`), `${file} holds the port`).toBe(false);
        expect(/q[0-9a-f]{5}z/.test(text), `${file} holds a fixture slug`).toBe(false);
        expect(/Sx-[0-9a-f]{16}-1a/.test(text), `${file} holds a password`).toBe(false);
        expect(/(?<![a-z0-9])[a-z0-9]{26}(?![a-z0-9])/.test(text), `${file} holds a server id`).toBe(false);
    }
}

// ---------------------------------------------------------------------------------------------------------
// Rules, verdicts, matchers, log, engine hash (no browser)
// ---------------------------------------------------------------------------------------------------------

test('outcome rules are read from the synthetic charter', () => {
    const rules = validateOutcomeCharter(baseCharter());
    expect(rules.classes).toEqual([
        {name: 'UNSEEN', clauses: [{checkpoint: 'T-SHOWN', value: false}]},
        {
            name: 'SEEN_COMPLETE',
            clauses: [
                {checkpoint: 'T-SHOWN', value: true},
                {checkpoint: 'T-ITEMS', value: true},
            ],
        },
        {
            name: 'SEEN_INCOMPLETE',
            clauses: [
                {checkpoint: 'T-SHOWN', value: true},
                {checkpoint: 'T-ITEMS', value: false},
            ],
        },
    ]);
    expect(rules.precedence.map((r) => [r.verdict, r.conditions])).toEqual([
        ['SETUP_BROKEN', [{kind: 'setup'}]],
        ['REGRESSION', [{kind: 'confirmed', cls: 'SEEN_INCOMPLETE'}]],
        ['UNDECIDED', [{kind: 'unconfirmed', cls: 'SEEN_INCOMPLETE'}]],
        [
            'OK',
            [
                {kind: 'confirmed', cls: 'SEEN_COMPLETE'},
                {kind: 'none', cls: 'SEEN_INCOMPLETE'},
            ],
        ],
        ['UNDECIDED', [{kind: 'always'}]],
    ]);
    expect(rules.confirmOrder).toEqual(['SEEN_INCOMPLETE', 'SEEN_COMPLETE']);
    expect(rules.preserveClasses).toEqual(['SEEN_INCOMPLETE']);
    expect(rules.noEarlyStop).toBe(true);
    expect(rules.reserved).toBe(4);
    expect(classify(rules, {'T-SHOWN': false}).cls).toBe('UNSEEN');
    expect(classify(rules, {'T-SHOWN': true, 'T-ITEMS': false}).cls).toBe('SEEN_INCOMPLETE');
    expect(classify(rules, {'T-SHOWN': true}).cls).toBe(null);
});

test('verdict precedence comes from the charter', () => {
    const rules = parseOutcomeRules(baseCharter());
    const decide = (
        classified: Array<[string, string]>,
        confirmed: Array<[string, string, boolean]>,
        setupFailed = false,
    ) =>
        decideVerdict(rules, {
            setupFailed,
            classified: classified.map(([cls, pathKey]) => ({cls, pathKey})),
            confirmations: new Map(confirmed.map(([cls, p, ok]) => [confirmationKey(cls, p), ok])),
        }).verdict;
    expect(decide([['SEEN_INCOMPLETE', 'a']], [['SEEN_INCOMPLETE', 'a', true]], true)).toBe('SETUP_BROKEN');
    expect(
        decide(
            [
                ['SEEN_INCOMPLETE', 'a'],
                ['SEEN_COMPLETE', 'b'],
            ],
            [
                ['SEEN_INCOMPLETE', 'a', true],
                ['SEEN_COMPLETE', 'b', true],
            ],
        ),
    ).toBe('REGRESSION');
    expect(
        decide(
            [
                ['SEEN_INCOMPLETE', 'a'],
                ['SEEN_COMPLETE', 'b'],
            ],
            [
                ['SEEN_INCOMPLETE', 'a', false],
                ['SEEN_COMPLETE', 'b', true],
            ],
        ),
    ).toBe('UNDECIDED');
    expect(decide([['SEEN_COMPLETE', 'b']], [['SEEN_COMPLETE', 'b', true]])).toBe('OK');
    expect(decide([['SEEN_COMPLETE', 'b']], [])).toBe('UNDECIDED');
    expect(decide([['UNSEEN', '']], [])).toBe('UNDECIDED');
    expect(decide([], [])).toBe('UNDECIDED');
});

test('rule text the grammar does not recognise is a charter error (fail closed)', () => {
    const broken: Array<(c: JourneyCharter) => void> = [
        (c) => {
            c.success_criteria.outcomes!.precedence.splice(2, 0, 'UNDECIDED if something odd');
        },
        (c) => {
            c.success_criteria.outcomes!.per_state_classification.UNSEEN = 'Nothing rendered.';
        },
        (c) => {
            c.success_criteria.outcomes!.precedence.pop();
        },
        (c) => {
            c.success_criteria.outcomes!.run_verdict.OK = 'Looks fine.';
        },
        (c) => {
            (ui(c, 'T-SHOWN').settle as Record<string, unknown>).rule = 'Wait a while.';
        },
        (c) => {
            (ui(c, 'T-SHOWN').post_scope as Record<string, unknown>).rule = 'Inside one container.';
        },
        (c) => {
            ui(c, 'T-ITEMS').evaluated_only_when = 'When the room has loaded.';
        },
    ];
    for (const mutate of broken) {
        const c = baseCharter();
        mutate(c);
        expect(() => validateOutcomeCharter(c)).toThrow(CharterRuleError);
    }
});

test('nested REST matchers, deep equality and template resolution', () => {
    const doc = {a: {list: [{x: 1, y: ''}, {x: 2}], s: 'v'}, n: null, flat: {key: 3}};
    expect(readPath(doc, 'a.list.length')).toBe(2);
    expect(readPath(doc, 'a.list[1].x')).toBe(2);
    expect(readPath(doc, 'a.list[0]')).toEqual({x: 1, y: ''});
    expect(readPath(doc, 'a.list[2].x')).toBeUndefined();
    expect(readPath(doc, 'a.s.length')).toBeUndefined();
    expect(readPath(doc, 'flat.key')).toBe(3);
    expect(readPath(doc, 'n.x')).toBeUndefined();
    expect(readPath(doc, 'a.')).toBeUndefined();
    expect(deepEqual({y: '', x: 1}, {x: 1, y: ''})).toBe(true);
    expect(deepEqual({x: 1}, {x: 1, y: ''})).toBe(false);
    expect(deepEqual([1, {a: [2]}], [1, {a: [2]}])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    const bindings = {
        team: {id: 't', name: 'tn'},
        actor: {},
        channel: {c: {id: 'cid', name: 'cn', display_name: 'C'}},
        event: {},
        fixture: {fixed_strings: {}},
        post: {p: {id: 'pid'}},
    } as Bindings;
    expect(resolveDeep({a: ['{channel.c.id}', 3, {b: '{post.p.id}'}]}, bindings)).toEqual({a: ['cid', 3, {b: 'pid'}]});
    expect(() => resolveDeep({a: '{post.missing.id}'}, bindings)).toThrow(/Unbound charter template/);
});

test('precondition source and read-back gating are charter-driven; legacy charters keep the legacy paths', () => {
    const c = baseCharter();
    expect(clientConfigRequestPath(c)).toBe('/api/v4/config/client?format=old');
    c.fixture.server_preconditions = {
        how: 'Read-only: GET /api/v4/config/client?format=old (some route note) before the fixture.',
        expect: {},
    };
    expect(clientConfigRequestPath(c)).toBe('/api/v4/config/client?format=old');
    c.fixture.server_preconditions = {how: 'Read-only: GET /api/v4/config as admin.', expect: {}};
    expect(clientConfigRequestPath(c)).toBe(null);
    for (const legacy of ['auto-follow']) {
        const charter = JSON.parse(
            fs.readFileSync(path.join(SESSIONS_DIR, legacy, 'charter.json'), 'utf-8'),
        ) as JourneyCharter;
        expect(hasOutcomes(charter)).toBe(false);
        expect(clientConfigRequestPath(charter)).toBe(null);
        expect(charter.fixture.posts).toBeUndefined();
        expect(/auto[-_ ]follow/i.test(charter.fixture.read_back ?? '')).toBe(true);
        expect(/\bthreads?\b/i.test(charter.fixture.read_back ?? '')).toBe(true);
    }
});

test('observation log: append-only, hash-chained, refuses reuse and unsanitized entries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-selftest-log-'));
    outputs.push(dir);
    const file = path.join(dir, OBSERVATION_LOG_FILE);
    const log = new ObservationLog(file);
    const prefixes: string[] = [];
    for (let i = 0; i < 5; i++) {
        log.append({kind: 'probe', i});
        prefixes.push(fs.readFileSync(file, 'utf-8'));
    }
    for (let i = 1; i < prefixes.length; i++) {
        expect(prefixes[i].startsWith(prefixes[i - 1])).toBe(true);
    }
    const lines = prefixes[4].trimEnd().split('\n');
    let before = '';
    for (const line of lines) {
        expect(JSON.parse(line).prev_sha256).toBe(sha256(before));
        before += `${line}\n`;
    }
    const scrubbed = log.append({kind: 'probe', url: 'http://127.0.0.1:1/x'});
    expect(JSON.stringify(scrubbed)).not.toContain('127.0.0.1');
    const sizeBefore = fs.statSync(file).size;
    expect(() => log.append({kind: 'probe', note: 'has secret-token-value'}, ['secret-token-value'])).toThrow(
        /not sanitized/,
    );
    expect(fs.statSync(file).size).toBe(sizeBefore);
    expect(() => new ObservationLog(file)).toThrow(/append-only/);
    expect(log.all().length).toBe(6);
});

test('engine hash is deterministic and its file list is the one documented in README-engine.md', () => {
    const a = engineHash();
    const b = engineHash();
    expect(a.sha256).toBe(b.sha256);
    expect(a.files).toContain('explorer-proto/playwright.config.ts');
    expect(a.files).toContain('explorer-proto/src/journey_selftest_charter.json');
    expect(a.files.every((f, i) => i === 0 || a.files[i - 1] < f)).toBe(true);
    const readme = fs.readFileSync(path.join(SRC_DIR, 'README-engine.md'), 'utf-8');
    const block = /<!-- engine-hash-files:begin -->\n```text\n([\s\S]*?)```\n<!-- engine-hash-files:end -->/.exec(
        readme,
    );
    expect(block, 'README-engine.md lists the engine-hash files').not.toBeNull();
    expect(block![1].trimEnd().split('\n')).toEqual(engineHashFiles());
});

test('regression: the committed auto-follow trace re-renders byte-identically', () => {
    const dir = path.join(SESSIONS_DIR, 'auto-follow', 'generated');
    const committedJson = fs.readFileSync(path.join(dir, 'trace.json'), 'utf-8');
    const committedMd = fs.readFileSync(path.join(dir, 'trace.md'), 'utf-8');
    const t = JSON.parse(committedJson) as Record<string, any>;
    const charter = JSON.parse(
        fs.readFileSync(path.join(SESSIONS_DIR, 'auto-follow', 'charter.json'), 'utf-8'),
    ) as JourneyCharter;
    const qualified = Object.fromEntries(Object.entries(t.qualified ?? {}).filter(([k]) => k !== 'confirmed'));
    const result = {
        goalTerms: t.goal_terms,
        counters: t.counters,
        stoppedReason: t.stopped_reason,
        serverPreconditions: t.server_preconditions,
        guardViolations: t.guard_violations,
        checkpointProgressBest: t.checkpoint_progress_best,
        observations: t.observations,
        qualified: t.qualified ? qualified : null,
        qualifyingPaths: t.qualifying_paths,
        states: (t.states as ObservedState[]).map((s) => ({
            ...s,
            // Not stored in trace.json: a menu or dialog was open exactly when Escape was offered.
            containerOpen: s.candidates.some((c) => c.role === 'key' && c.name === 'Escape'),
        })),
        transitions: t.transitions,
        budgetSkips: t.budgetSkips,
        bestFrontier: [],
        wallClockSeconds: 0,
    } as unknown as SearchResult;
    expect(journeyTraceJson(charter, result)).toBe(committedJson);
    expect(renderJourneyTrace(charter, result)).toBe(committedMd);
});

// ---------------------------------------------------------------------------------------------------------
// Scenarios against the loopback app
// ---------------------------------------------------------------------------------------------------------

test.describe('scenarios', () => {
    test.setTimeout(300_000);

    test('(i) every item renders: PASS-class verdict, no early stop, build identity reported', async ({browser}) => {
        const s = await runScenario(browser, 'complete', {render: 'complete'});
        expect(s.report.run_verdict).toBe('OK');
        expect(s.report.failing_observations).toEqual([]);
        expect(s.report.build_identity).toEqual({Version: '0.0.0-selftest', BuildHash: 'selftest-build'});
        expect(s.report.representative_confirmed_path.SEEN_COMPLETE).not.toBeNull();
        expect(s.report.replay_errors).toEqual([]);
        // No early stop: after the first complete render the search kept going and saw a second surface.
        const surfaces = new Set(statesOf(s, 'SEEN_COMPLETE').map((e) => e.url_path));
        expect(surfaces.size).toBeGreaterThanOrEqual(2);
        expect(s.result.stoppedReason).toMatch(/budget exhausted|frontier exhausted/);
        expect(s.result.counters.actions).toBeGreaterThanOrEqual(4);
        expect(s.report.budget_reserve.reserved).toBe(4);
        expect(s.report.evidence_method_per_string['Silver ribbon (0 awards) =']).toMatchObject({dom: 0});
        expectSanitized(s.dir);
    });

    test('(ii)+(vii) item missing in the first reachable state, complete elsewhere: failure wins, log is append-only', async ({
        browser,
    }) => {
        const s = await runScenario(browser, 'drop-empty', {render: 'drop-empty'});
        expect(s.report.run_verdict).toBe('REGRESSION');
        const failing = s.report.failing_observations as Array<Record<string, any>>;
        expect(failing.length).toBeGreaterThan(0);
        expect(failing.some((f) => f.path_text === 'link "Showcase"' && f.confirmed === true)).toBe(true);
        expect(statesOf(s, 'SEEN_COMPLETE').length).toBeGreaterThan(0);
        expect(s.report.representative_confirmed_path.SEEN_INCOMPLETE.path_text).toBe('link "Showcase"');
        // Failing paths were confirmed before passing paths.
        const firstConfirmations = (s.report.confirmations as Array<Record<string, any>>).filter((c) => c.attempted);
        expect(firstConfirmations[0].classification).toBe('SEEN_INCOMPLETE');
        // (vii)
        expect(s.appendChecks).toBe(s.log.length);
        expect(s.appendViolations).toEqual([]);
        expect(s.log.map((e) => e.seq)).toEqual(s.log.map((_, i) => i + 1));
        const scoped = s.log.filter((e) => e.kind === 'checkpoint' && e.checkpoint === 'T-ITEMS' && e.evaluated);
        expect(scoped.every((e) => /post_scope: snapshot listitem container/.test(e.scope))).toBe(true);
        expectSanitized(s.dir);
    });

    test('(iii) nothing ever renders: INCONCLUSIVE-class verdict', async ({browser}) => {
        const s = await runScenario(browser, 'hidden', {render: 'hidden'});
        expect(s.report.run_verdict).toBe('UNDECIDED');
        expect(s.report.verdict_rule).toBe('UNDECIDED');
        expect(s.report.states_per_classification.UNSEEN.observations).toBeGreaterThan(0);
        expect(s.report.states_per_classification.SEEN_COMPLETE.observations).toBe(0);
        expect(s.report.states_per_classification.SEEN_INCOMPLETE.observations).toBe(0);
        expect(s.report.confirmations).toEqual([]);
        const shown = s.log.filter((e) => e.kind === 'checkpoint' && e.checkpoint === 'T-SHOWN');
        expect(shown.every((e) => e.settle.outcome === 'false-after-wait' && e.settle.limit_ms === 1500)).toBe(true);
        expect(
            s.log.filter((e) => e.checkpoint === 'T-ITEMS').every((e) => e.evaluated === false && e.result === null),
        ).toBe(true);
    });

    const slowSettle = (c: JourneyCharter) => {
        (ui(c, 'T-SHOWN').settle as Record<string, unknown>).rule = 'Re-check for up to 4000 ms.';
        (ui(c, 'T-ITEMS').settle as Record<string, unknown>).ms = 3000;
        c.budget = {...c.budget, max_actions: 3, max_depth: 1, max_replays: 8};
        c.budget_reserve = {confirmation_replays_reserved: 3};
    };

    test('(iv) delayed render inside the settle window is classified correctly', async ({browser}) => {
        const post = await runScenario(browser, 'delayed-post', {render: 'delayed-post', delayMs: 1800}, slowSettle);
        expect(post.report.run_verdict).toBe('OK');
        expect(post.report.failing_observations).toEqual([]);
        expect(
            post.log.some(
                (e) =>
                    e.checkpoint === 'T-SHOWN' &&
                    e.url_path.includes('showcase') &&
                    e.settle.outcome === 'true-after-wait',
            ),
        ).toBe(true);
        const rows = await runScenario(browser, 'delayed-rows', {render: 'delayed-rows', delayMs: 1800}, slowSettle);
        expect(rows.report.run_verdict).toBe('OK');
        expect(statesOf(rows, 'SEEN_INCOMPLETE')).toEqual([]);
        expect(rows.log.some((e) => e.checkpoint === 'T-ITEMS' && e.settle.outcome === 'true-after-wait')).toBe(true);
    });

    test('(iv control) the same delayed rows without a settle window are misclassified, so settle is not vacuous', async ({
        browser,
    }) => {
        const s = await runScenario(browser, 'delayed-rows-nosettle', {render: 'delayed-rows', delayMs: 1800}, (c) => {
            slowSettle(c);
            delete ui(c, 'T-SHOWN').settle;
            delete ui(c, 'T-ITEMS').settle;
        });
        expect(statesOf(s, 'SEEN_INCOMPLETE').length).toBeGreaterThan(0);
        expect(s.report.run_verdict).toBe('REGRESSION');
    });

    test('(v) a missing item that a fresh-fixture replay does not reproduce: INCONCLUSIVE, observation preserved', async ({
        browser,
    }) => {
        const s = await runScenario(browser, 'first-team-only', {render: 'drop-empty-first-team-only'});
        expect(s.report.run_verdict).toBe('UNDECIDED');
        expect(s.report.verdict_rule).toBe('UNDECIDED when an unconfirmed SEEN_INCOMPLETE exists');
        const failing = s.report.failing_observations as Array<Record<string, any>>;
        expect(failing.length).toBe(1);
        expect(failing[0].confirmed).toBe(false);
        expect(failing[0].path_text).toBe('link "Showcase"');
        expect((s.report.flakiness as Array<Record<string, any>>).length).toBeGreaterThan(0);
        expect(statesOf(s, 'SEEN_INCOMPLETE').length).toBe(1);
    });

    test('(v-b) a missing item with no replay budget left to confirm it: INCONCLUSIVE, marked not attempted', async ({
        browser,
    }) => {
        const s = await runScenario(browser, 'starved', {render: 'drop-empty'}, (c) => {
            c.budget = {...c.budget, max_actions: 1, max_replays: 2};
            c.budget_reserve = {confirmation_replays_reserved: 0};
        });
        expect(s.report.run_verdict).toBe('UNDECIDED');
        const failing = s.report.failing_observations as Array<Record<string, any>>;
        expect(failing.length).toBe(1);
        expect(failing[0].confirmed).toBe('not attempted');
        expect(failing[0].confirmation_note).toMatch(/budget/);
    });

    test('(vi) precondition mismatch, rejected fixture post and wrong stored data are setup failures', async ({
        browser,
    }) => {
        const flag = await runScenario(browser, 'flag', {
            render: 'complete',
            clientConfig: {FeatureFlagRibbonTally: 'false'},
        });
        expect(flag.report.run_verdict).toBe('SETUP_BROKEN');
        expect(flag.report.setup_failure.phase).toBe('server preconditions');
        expect(app.teams.size).toBe(0);
        expect(flag.log.map((e) => e.kind)).toEqual(['setup_failure', 'verdict']);

        const rejected = await runScenario(browser, 'post-rejected', {render: 'complete', postStatus: 403});
        expect(rejected.report.run_verdict).toBe('SETUP_BROKEN');
        expect(rejected.report.setup_failure.phase).toBe('fixture');
        expect(rejected.report.setup_failure.message).toMatch(/fixture post tally: HTTP 403 \(expected 201\)/);

        const corrupt = await runScenario(browser, 'stored-wrong', {render: 'complete', corruptStoredPost: true});
        expect(corrupt.report.run_verdict).toBe('SETUP_BROKEN');
        expect(corrupt.report.setup_failure.phase).toBe('read-back');
        const readBack = corrupt.log.find((e) => e.kind === 'read_back')!;
        expect(readBack.result).toBe(false);
        expect(readBack.clauses[0].desc).toMatch(/props\.tally\.items\.length=MISS/);
        expect(readBack.clauses[0].desc).toMatch(/props\.tally\.items\[1\]=ok/);
    });

    test('(viii) items present elsewhere on the page but not in the anchored container are missing', async ({
        browser,
    }) => {
        const scoped = await runScenario(browser, 'decoy', {render: 'drop-empty', decoyInSidebar: true});
        expect(scoped.report.run_verdict).toBe('REGRESSION');
        const showcase = statesOf(scoped, 'SEEN_INCOMPLETE');
        expect(showcase.length).toBeGreaterThan(0);
        // Page-wide control run: the same page without post_scope matches page-wide and calls it complete.
        const pageWide = await runScenario(
            browser,
            'decoy-pagewide',
            {render: 'drop-empty', decoyInSidebar: true},
            (c) => {
                delete ui(c, 'T-SHOWN').post_scope;
                delete ui(c, 'T-ITEMS').post_scope;
            },
        );
        expect(statesOf(pageWide, 'SEEN_INCOMPLETE')).toEqual([]);
        expect(pageWide.report.run_verdict).toBe('OK');
        expect(
            pageWide.log
                .filter((e) => e.kind === 'checkpoint' && e.checkpoint_kind === 'ui' && e.evaluated)
                .every((e) => e.scope === 'page-wide (no post_scope declared)'),
        ).toBe(true);
    });

    test('DOM fallback: strings absent from the accessibility tree are found in the DOM and reported as such', async ({
        browser,
    }) => {
        const s = await runScenario(browser, 'dom-only', {render: 'rows-dom-only'});
        expect(s.report.run_verdict).toBe('OK');
        expect(s.report.evidence_method_per_string['Silver ribbon (0 awards) ='].dom).toBeGreaterThan(0);
        expect(s.report.evidence_method_per_string['Ribbon tally: spring fair'].snapshot).toBeGreaterThan(0);
        // The room view hides the empty-count rows from the accessibility tree; the overview renders them normally.
        const roomRows = s.log.filter(
            (e) => e.checkpoint === 'T-ITEMS' && e.evaluated && e.url_path.includes('<channel:showcase>'),
        );
        expect(roomRows.length).toBeGreaterThan(0);
        expect(roomRows.every((e) => e.clauses.every((c: {method: string}) => c.method === 'dom'))).toBe(true);
        const overviewRows = s.log.filter(
            (e) => e.checkpoint === 'T-ITEMS' && e.evaluated && e.url_path.endsWith('/overview'),
        );
        expect(overviewRows.every((e) => e.clauses.every((c: {method: string}) => c.method === 'snapshot'))).toBe(true);
    });
});
