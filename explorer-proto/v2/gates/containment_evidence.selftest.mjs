// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Self-test for containment_evidence.mjs.
import fs from 'node:fs';
import path from 'node:path';

import {GATES_DIR, sha256} from './common.mjs';
import {buildRecord, checkContainment} from './containment_evidence.mjs';

const FIXTURES = path.join(GATES_DIR, 'fixtures');
const SPEC_FIXTURE = path.join(FIXTURES, 'specs/good_bookmarks.spec.ts.txt');

const blockedMode = () => ({
    second_origin_rejected: {loopback_alias: 'blocked', same_host_other_port: 'blocked'},
    websocket_other_origin_closed: {loopback_alias: 'blocked', same_host_other_port: 'blocked'},
    service_workers: {register_attempted: true, script_requests: 0},
    second_server_hits: {http: 0, websocket_upgrades: 0},
    violations: 0,
    violations_after_close: 0,
});

const goodRecord = () => ({
    schema: 'explorer-containment-evidence/v1',
    scope: {
        kind: 'spec_as_run',
        spec: 'explorer-proto/sessions/bookmarks/generated/x.spec.ts',
        config: 'explorer-proto/playwright.config.ts',
    },
    modes: {exploration: blockedMode(), replay: blockedMode()},
    race: {iterations_planned: 40, iterations_completed: 40, unexpected_handler_errors: 0},
});

const edit = (mutate) => {
    const record = goodRecord();
    mutate(record);
    return record;
};
const put = (record, dotted, value) => {
    const keys = dotted.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], record);
    target[last] = value;
};
const drop = (record, dotted) => {
    const keys = dotted.split('.');
    const last = keys.pop();
    delete keys.reduce((o, k) => o[k], record)[last];
};

const CASES = [
    {name: 'complete spec-as-run record', record: goodRecord(), want: 'pass', rules: []},
    {
        name: 'journey mode evidence is checked too',
        record: edit((r) => put(r, 'modes.journey', {...blockedMode(), violations: 2})),
        want: 'fail',
        rules: ['modes.journey.violations.nonzero'],
    },
    {
        name: 'engine-only evidence (guard-check, not the spec as run) is blocked',
        record: edit((r) => put(r, 'scope', {kind: 'engine_only'})),
        want: 'blocked',
        rules: ['scope.not_spec_as_run'],
    },
    {
        name: 'no scope at all is blocked',
        record: edit((r) => drop(r, 'scope')),
        want: 'blocked',
        rules: ['scope.not_spec_as_run'],
    },
    {
        name: 'spec-as-run without a spec path is blocked',
        record: edit((r) => drop(r, 'scope.spec')),
        want: 'blocked',
        rules: ['scope.spec_or_config_missing'],
    },
    {
        name: 'wrong record schema is blocked',
        record: edit((r) => put(r, 'schema', 'other')),
        want: 'blocked',
        rules: ['record.schema_missing'],
    },
    {name: 'a string is not a record (blocked)', record: 'pass', want: 'blocked', rules: ['record.schema_missing']},
    {
        name: 'missing replay mode is blocked',
        record: edit((r) => drop(r, 'modes.replay')),
        want: 'blocked',
        rules: ['modes.replay.missing'],
    },
    {
        name: 'missing exploration mode is blocked',
        record: edit((r) => drop(r, 'modes.exploration')),
        want: 'blocked',
        rules: ['modes.exploration.missing'],
    },
    {
        name: 'second origin not rejected in replay is a fail',
        record: edit((r) => put(r, 'modes.replay.second_origin_rejected.same_host_other_port', 'allowed')),
        want: 'fail',
        rules: ['modes.replay.second_origin_rejected.same_host_other_port.not_blocked'],
    },
    {
        name: 'loopback alias not rejected in exploration is a fail',
        record: edit((r) => put(r, 'modes.exploration.second_origin_rejected.loopback_alias', 'loaded')),
        want: 'fail',
        rules: ['modes.exploration.second_origin_rejected.loopback_alias.not_blocked'],
    },
    {
        name: 'WebSocket other origin not closed is a fail',
        record: edit((r) => put(r, 'modes.replay.websocket_other_origin_closed.loopback_alias', 'open')),
        want: 'fail',
        rules: ['modes.replay.websocket_other_origin_closed.loopback_alias.not_blocked'],
    },
    {
        name: 'missing WebSocket evidence is blocked',
        record: edit((r) => drop(r, 'modes.replay.websocket_other_origin_closed')),
        want: 'blocked',
        rules: ['modes.replay.websocket_other_origin_closed.loopback_alias.missing'],
    },
    {
        name: 'a service worker script was fetched (fail)',
        record: edit((r) => put(r, 'modes.replay.service_workers.script_requests', 1)),
        want: 'fail',
        rules: ['modes.replay.service_workers.script_requested'],
    },
    {
        name: 'no service worker probe is blocked',
        record: edit((r) => drop(r, 'modes.exploration.service_workers')),
        want: 'blocked',
        rules: ['modes.exploration.service_workers.probe_missing'],
    },
    {
        name: 'the second server saw an HTTP request (fail)',
        record: edit((r) => put(r, 'modes.exploration.second_server_hits.http', 1)),
        want: 'fail',
        rules: ['modes.exploration.second_server_hits.nonzero'],
    },
    {
        name: 'the second server saw an upgrade (fail)',
        record: edit((r) => put(r, 'modes.replay.second_server_hits.websocket_upgrades', 2)),
        want: 'fail',
        rules: ['modes.replay.second_server_hits.nonzero'],
    },
    {
        name: 'guard violations recorded (fail)',
        record: edit((r) => put(r, 'modes.replay.violations', 1)),
        want: 'fail',
        rules: ['modes.replay.violations.nonzero'],
    },
    {
        name: 'violations after close recorded (fail)',
        record: edit((r) => put(r, 'modes.replay.violations_after_close', 3)),
        want: 'fail',
        rules: ['modes.replay.violations_after_close.nonzero'],
    },
    {
        name: 'no race evidence is blocked',
        record: edit((r) => drop(r, 'race')),
        want: 'blocked',
        rules: ['race.missing'],
    },
    {
        name: 'race stopped early (fail)',
        record: edit((r) => put(r, 'race.iterations_completed', 39)),
        want: 'fail',
        rules: ['race.incomplete'],
    },
    {
        name: 'race with too few iterations (fail)',
        record: edit((r) =>
            put(r, 'race', {iterations_planned: 5, iterations_completed: 5, unexpected_handler_errors: 0}),
        ),
        want: 'fail',
        rules: ['race.too_few_iterations'],
    },
    {
        name: 'race with unexpected handler errors (fail)',
        record: edit((r) => put(r, 'race.unexpected_handler_errors', 1)),
        want: 'fail',
        rules: ['race.unexpected_handler_errors'],
    },
    {
        name: 'fail beats blocked when both are present',
        record: edit((r) => {
            put(r, 'modes.replay.violations', 1);
            drop(r, 'race');
        }),
        want: 'fail',
        rules: ['modes.replay.violations.nonzero', 'race.missing'],
    },
];

export function selftestChecks() {
    const checks = CASES.map((c) => {
        const result = checkContainment(c.record);
        const rules = result.evidence.map((e) => e.rule);
        const missing = c.rules.filter((r) => !rules.includes(r));
        const ok = result.status === c.want && missing.length === 0;
        return {
            name: `containment_evidence: ${c.name}`,
            ok,
            detail: ok ? '' : `status ${result.status}; missing ${missing.join(',') || 'none'}; got ${rules.join(',')}`,
        };
    });

    const spec = fs.readFileSync(SPEC_FIXTURE);
    const bound = edit((r) => put(r, 'scope.spec_sha256', sha256(spec)));
    const wrong = edit((r) => put(r, 'scope.spec_sha256', '0'.repeat(64)));
    const unbound = goodRecord();
    const hashCases = [
        ['spec bound by sha256 matches the file', checkContainment(bound, {specFile: SPEC_FIXTURE}), 'pass'],
        ['spec sha256 of a different file is a fail', checkContainment(wrong, {specFile: SPEC_FIXTURE}), 'fail'],
        [
            'no spec sha256 when a spec file is supplied is blocked',
            checkContainment(unbound, {specFile: SPEC_FIXTURE}),
            'blocked',
        ],
        ['a stricter minimum race count is honoured', checkContainment(goodRecord(), {minRaceIterations: 100}), 'fail'],
    ];
    for (const [name, result, want] of hashCases) {
        checks.push({
            name: `containment_evidence: ${name}`,
            ok: result.status === want,
            detail: `status ${result.status}`,
        });
    }

    const guardReport = fs.readFileSync(path.join(FIXTURES, 'guard-report.sample.md'), 'utf8');
    const raceReport = fs.readFileSync(path.join(FIXTURES, 'guard-race-report.sample.md'), 'utf8');
    const engineOnly = checkContainment(buildRecord({guardReport, raceReport}));
    checks.push({
        name: 'containment_evidence: the engine guard-check reports alone are blocked (not spec-as-run)',
        ok:
            engineOnly.status === 'blocked' &&
            engineOnly.evidence.some((e) => e.rule === 'scope.not_spec_as_run') &&
            engineOnly.evidence.every((e) => e.result === 'blocked'),
        detail: JSON.stringify(engineOnly.evidence),
    });
    const attested = checkContainment(buildRecord({guardReport, raceReport, scope: goodRecord().scope}));
    checks.push({
        name: 'containment_evidence: the same reports pass once the run attests spec-as-run scope',
        ok: attested.status === 'pass',
        detail: JSON.stringify(attested.evidence),
    });
    const broken = buildRecord({
        guardReport: guardReport.replace('violations: 0', 'violations: 2'),
        raceReport,
        scope: goodRecord().scope,
    });
    checks.push({
        name: 'containment_evidence: a guard report with violations converts into a failing record',
        ok: checkContainment(broken).status === 'fail',
        detail: '',
    });
    const noWs = buildRecord({
        guardReport: guardReport
            .split('\n')
            .filter((l) => !l.includes('|websocket|'))
            .join('\n'),
        raceReport,
        scope: goodRecord().scope,
    });
    checks.push({
        name: 'containment_evidence: a guard report without WebSocket lines converts into a blocked record',
        ok: checkContainment(noWs).status === 'blocked',
        detail: '',
    });
    const journeyReport = fs.readFileSync(path.join(FIXTURES, 'guard-journey-report.sample.md'), 'utf8');
    const journey = checkContainment(buildRecord({journeyReport, scope: goodRecord().scope}));
    const journeyRules = journey.evidence.map((e) => e.rule);
    checks.push({
        name: 'containment_evidence: the real journey report (second 127.0.0.1 origin reachable, 1 server hit) is a fail',
        ok:
            journey.status === 'fail' &&
            journeyRules.includes('modes.replay.second_origin_rejected.same_host_other_port.not_blocked') &&
            journeyRules.includes('modes.replay.second_server_hits.nonzero'),
        detail: journeyRules.join(','),
    });
    checks.push({
        name: 'containment_evidence: the journey report has no exploration, service worker or race evidence (blocked items)',
        ok: ['modes.exploration.missing', 'modes.replay.service_workers.probe_missing', 'race.missing'].every((r) =>
            journeyRules.includes(r),
        ),
        detail: journeyRules.join(','),
    });
    const fixedJourney = journeyReport.replace(
        'second 127.0.0.1 origin on another port (HTTP): reached; server hits: 1',
        'second 127.0.0.1 origin on another port (HTTP): blocked; server hits: 0',
    );
    const repaired = checkContainment(buildRecord({journeyReport: fixedJourney, scope: goodRecord().scope}));
    checks.push({
        name: 'containment_evidence: with the gap closed the journey report is still only blocked (missing evidence), never pass',
        ok: repaired.status === 'blocked',
        detail: repaired.status,
    });
    return checks;
}
