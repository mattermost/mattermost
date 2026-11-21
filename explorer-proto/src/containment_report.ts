// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import type {ProxyStats} from './containment_proxy.ts';
import type {ServerCounters} from './fixture_servers.ts';
import {isZero} from './containment_suite.ts';
import type {SuiteResult} from './containment_suite.ts';

export const FRAGMENT_SCHEMA = 'explorer-containment-fragment/v1';
export const RECORD_SCHEMA = 'explorer-containment-evidence/v1';

export type ProbeRecord = {
    name: string;
    client: string;
    second: ServerCounters;
    approved: ServerCounters;
    approvedSawLocalhostHost: boolean;
};

export type RunRecord = {
    id: string;
    kind: 'control' | 'contained';
    launch: string;
    probes: ProbeRecord[];
    leaked: string[];
    failures: string[];
    secondTotals: ServerCounters;
    secondTotalsAfterClose: ServerCounters;
    approvedTotals: ServerCounters;
    swScriptRequests: number;
    swControlRequests?: number;
    browserVersion?: string;
    proxy: ProxyStats | null;
    externalMapsToSecond: boolean;
    violations?: number;
    violationsAfterClose?: number;
};

export type Fragment = {schema: typeof FRAGMENT_SCHEMA; runs: RunRecord[]};

export function toProbeRecords(result: SuiteResult): ProbeRecord[] {
    return result.probes.map((p) => ({
        name: p.name,
        client: p.client,
        second: p.secondDelta,
        approved: p.approvedDelta,
        approvedSawLocalhostHost: p.approvedHosts.some((h) => h.startsWith('localhost')),
    }));
}

export function writeJson(file: string, value: unknown) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readFragment(file: string): Fragment {
    const fragment = JSON.parse(fs.readFileSync(file, 'utf8')) as Fragment;
    if (fragment.schema !== FRAGMENT_SCHEMA) {
        throw new Error(`${path.basename(file)} is not a ${FRAGMENT_SCHEMA} file`);
    }
    return fragment;
}

export const counterLine = (c: ServerCounters) =>
    `connections ${c.connections}, http requests ${c.httpRequests}, upgrades ${c.upgrades}`;

/** Maps one run's probes onto the gate's per-mode shape; "blocked" means the second server counted nothing. */
export function toGateMode(run: RunRecord, violations: number, violationsAfterClose: number) {
    const probe = (name: string) => run.probes.find((p) => p.name === name);
    const verdict = (name: string, side: 'second' | 'approved') => {
        const p = probe(name);
        if (!p) {
            return undefined;
        }
        if (side === 'approved') {
            return isZero(p.approved) && !p.approvedSawLocalhostHost && isZero(p.second) ? 'blocked' : 'reached';
        }
        return isZero(p.second) ? 'blocked' : 'reached';
    };
    const secondHttp = ['second.navigate', 'second.subresources', 'second.redirect-cross-origin'];
    const sameHostOtherPort = secondHttp.every((n) => verdict(n, 'second') === 'blocked') ? 'blocked' : 'reached';
    const loopbackAlias = ['localhost.navigate', 'localhost.subresources'].every(
        (n) => verdict(n, 'approved') === 'blocked',
    )
        ? 'blocked'
        : 'reached';
    return {
        second_origin_rejected: {
            loopback_alias: loopbackAlias,
            same_host_other_port: sameHostOtherPort,
        },
        websocket_other_origin_closed: {
            loopback_alias: verdict('localhost.websocket', 'approved') ?? 'reached',
            same_host_other_port: verdict('second.websocket', 'second') ?? 'reached',
        },
        service_workers: {
            register_attempted: probe('service-worker.register') !== undefined,
            script_requests: run.swScriptRequests,
        },
        second_server_hits: {
            http: run.secondTotalsAfterClose.httpRequests,
            websocket_upgrades: run.secondTotalsAfterClose.upgrades,
            connections: run.secondTotalsAfterClose.connections,
        },
        violations,
        violations_after_close: violationsAfterClose,
        evidence: {
            second_server_totals: run.secondTotals,
            second_server_totals_after_close: run.secondTotalsAfterClose,
            leaked_probes: run.leaked,
            external_name_maps_to_second_server: run.externalMapsToSecond,
        },
    };
}

export type RaceFragment = {
    schema: 'explorer-containment-race/v1';
    iterations_planned: number;
    iterations_completed: number;
    unexpected_handler_errors: number;
    second_server_totals: ServerCounters;
    positive_control_totals: ServerCounters;
};

/**
 * Assembles the record explorer-proto/v2/gates/containment_evidence.mjs reads. `exploration` and `replay` are the
 * application-level guard; `journey` is the thin-config run of a plain spec. Throws when any needed run is
 * missing, any run recorded a failure, or a positive control did not actually leak.
 */
export function buildEvidenceRecord(input: {
    check: Fragment;
    race: RaceFragment;
    journey: Fragment;
    spec: {path: string; sha256: string};
    config: string;
}) {
    const find = (fragment: Fragment, id: string) => {
        const run = fragment.runs.find((r) => r.id === id);
        if (!run) {
            throw new Error(`containment run "${id}" is missing: run guard-check and guard-journey first`);
        }
        return run;
    };
    const exploration = find(input.check, 'exploration');
    const replay = find(input.check, 'replay');
    const journey = find(input.journey, 'thin-config-contained');
    const controls = [find(input.check, 'control-unguarded'), find(input.journey, 'thin-config-control')];
    const problems = [exploration, replay, journey, ...controls].flatMap((r) => r.failures.map((f) => `${r.id}: ${f}`));
    for (const control of controls) {
        if (control.leaked.length === 0) {
            problems.push(`${control.id}: the positive control leaked nothing, so the check would pass vacuously`);
        }
    }
    if (problems.length > 0) {
        throw new Error(`containment evidence has failures: ${problems.join('; ')}`);
    }
    return {
        schema: RECORD_SCHEMA,
        scope: {
            kind: 'spec_as_run',
            spec: input.spec.path,
            spec_sha256: input.spec.sha256,
            config: input.config,
            note: 'the spec run through the thin config is the generated scratch spec of guard-journey, not a pilot spec',
        },
        modes: {
            exploration: toGateMode(exploration, exploration.violations ?? 0, exploration.violationsAfterClose ?? 0),
            replay: toGateMode(replay, replay.violations ?? 0, replay.violationsAfterClose ?? 0),
            journey: toGateMode(
                journey,
                journey.violations ?? journey.leaked.length,
                journey.violationsAfterClose ?? (isZero(journey.secondTotalsAfterClose) ? 0 : 1),
            ),
        },
        race: {
            iterations_planned: input.race.iterations_planned,
            iterations_completed: input.race.iterations_completed,
            unexpected_handler_errors: input.race.unexpected_handler_errors,
            second_server_totals: input.race.second_server_totals,
            positive_control_totals: input.race.positive_control_totals,
        },
        positive_controls: controls.map((c) => ({
            id: c.id,
            leaked_probes: c.leaked,
            second_server_totals: c.secondTotalsAfterClose,
        })),
    };
}
