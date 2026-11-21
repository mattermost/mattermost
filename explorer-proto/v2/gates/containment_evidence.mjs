#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Gate `containment_evidence`: validates a containment evidence record. Missing evidence is `blocked`, never pass.
//
// Record (schema "explorer-containment-evidence/v1"):
//   scope: {kind: "spec_as_run", spec, spec_sha256?, config}   evidence for the repo-native spec run through the thin
//                                                              config; kind "engine_only" (guard-check on the engine)
//                                                              is not enough and yields blocked
//   modes: {exploration: MODE, replay: MODE, journey?: MODE}   exploration and replay are required
//   race:  {iterations_planned, iterations_completed, unexpected_handler_errors}
//   MODE:  {second_origin_rejected: {loopback_alias, same_host_other_port},     each "blocked"
//           websocket_other_origin_closed: {loopback_alias, same_host_other_port},   each "blocked"
//           service_workers: {register_attempted: true, script_requests: 0},
//           second_server_hits: {http: 0, websocket_upgrades: 0}, violations: 0, violations_after_close: 0}
//
// `--from-guard-report` converts the engine's guard-check and guard-race markdown reports into a record. That record
// is `engine_only` unless the caller attests `--spec-as-run --spec <file> --config <file>`; the gate cannot verify
// provenance beyond binding the spec by sha256, so the attestation belongs to the run that produced the reports.
//
// Interface: gate.run({record: object|path, specFile?, minRaceIterations?}) -> {status, evidence}.
// CLI: containment_evidence.mjs [--spec-file f] [--min-race n] <record.json>
//      containment_evidence.mjs --from-guard-report <guard-report.md> --race <guard-race-report.md> [--spec-as-run --spec f --config f]
//      containment_evidence.mjs --from-journey-report <guard-journey-report.md> --spec-as-run --spec f --config f
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
    UsageError,
    exitCodeFor,
    guarded,
    parseArgs,
    positiveInt,
    printJson,
    readJsonFile,
    runCli,
    sha256,
    worstStatus,
} from './common.mjs';

export const RECORD_SCHEMA = 'explorer-containment-evidence/v1';
export const DEFAULT_MIN_RACE_ITERATIONS = 40;
const REQUIRED_MODES = ['exploration', 'replay'];
const VARIANTS = ['loopback_alias', 'same_host_other_port'];

function checkMode(name, mode, add) {
    const where = `modes.${name}`;
    if (mode === undefined || mode === null || typeof mode !== 'object') {
        add('blocked', `${where}.missing`);
        return;
    }
    const requireBlocked = (group, field) => {
        for (const variant of VARIANTS) {
            const value = mode[group]?.[variant];
            if (value === undefined) {
                add('blocked', `${where}.${field}.${variant}.missing`);
            } else if (value !== 'blocked') {
                add('fail', `${where}.${field}.${variant}.not_blocked`);
            }
        }
    };
    requireBlocked('second_origin_rejected', 'second_origin_rejected');
    requireBlocked('websocket_other_origin_closed', 'websocket_other_origin_closed');

    const sw = mode.service_workers;
    if (sw?.register_attempted !== true || typeof sw?.script_requests !== 'number') {
        add('blocked', `${where}.service_workers.probe_missing`);
    } else if (sw.script_requests !== 0) {
        add('fail', `${where}.service_workers.script_requested`);
    }
    const hits = mode.second_server_hits;
    if (hits?.http > 0 || hits?.websocket_upgrades > 0) {
        add('fail', `${where}.second_server_hits.nonzero`);
    } else if (typeof hits?.http !== 'number' || typeof hits?.websocket_upgrades !== 'number') {
        add('blocked', `${where}.second_server_hits.missing`);
    }
    for (const field of ['violations', 'violations_after_close']) {
        if (typeof mode[field] !== 'number') {
            add('blocked', `${where}.${field}.missing`);
        } else if (mode[field] !== 0) {
            add('fail', `${where}.${field}.nonzero`);
        }
    }
}

export function checkContainment(record, {specFile, minRaceIterations = DEFAULT_MIN_RACE_ITERATIONS} = {}) {
    const findings = [];
    const add = (status, rule) => findings.push({status, rule});

    if (!record || typeof record !== 'object' || record.schema !== RECORD_SCHEMA) {
        add('blocked', 'record.schema_missing');
    } else {
        const scope = record.scope;
        if (scope?.kind !== 'spec_as_run') {
            add('blocked', 'scope.not_spec_as_run');
        } else if (
            typeof scope.spec !== 'string' ||
            !scope.spec.endsWith('.spec.ts') ||
            typeof scope.config !== 'string'
        ) {
            add('blocked', 'scope.spec_or_config_missing');
        } else if (specFile !== undefined) {
            const actual = sha256(fs.readFileSync(specFile));
            if (scope.spec_sha256 === undefined) {
                add('blocked', 'scope.spec_sha256_missing');
            } else if (scope.spec_sha256 !== actual) {
                add('fail', 'scope.spec_sha256_mismatch');
            }
        }
        for (const name of REQUIRED_MODES) {
            checkMode(name, record.modes?.[name], add);
        }
        for (const name of Object.keys(record.modes ?? {}).filter((m) => !REQUIRED_MODES.includes(m))) {
            checkMode(name, record.modes[name], add);
        }
        const race = record.race;
        if (
            typeof race?.iterations_completed !== 'number' ||
            typeof race?.iterations_planned !== 'number' ||
            typeof race?.unexpected_handler_errors !== 'number'
        ) {
            add('blocked', 'race.missing');
        } else {
            if (race.iterations_completed !== race.iterations_planned) {
                add('fail', 'race.incomplete');
            }
            if (race.iterations_completed < minRaceIterations) {
                add('fail', 'race.too_few_iterations');
            }
            if (race.unexpected_handler_errors !== 0) {
                add('fail', 'race.unexpected_handler_errors');
            }
        }
    }
    const status = worstStatus(...findings.map((f) => f.status));
    return {status, evidence: findings.map((f) => ({rule: f.rule, result: f.status}))};
}

const MODE_HEADING = /^##\s+(exploration|replay)\s+mode\b/i;

// Reads the markdown the engine's guard-check writes (one section per mode).
export function parseGuardReport(markdown) {
    const modes = {};
    let current;
    for (const line of markdown.split('\n')) {
        const heading = MODE_HEADING.exec(line);
        if (heading) {
            current = heading[1].toLowerCase();
            modes[current] = {
                second_origin_rejected: {},
                websocket_other_origin_closed: {},
            };
            continue;
        }
        if (/^##\s/.test(line)) {
            current = undefined;
        }
        if (!current) {
            continue;
        }
        const mode = modes[current];
        const blocked = /^- blocked ([a-z]+)\|(http|websocket)\|([a-z-]+)\|([a-z]+): (\d+)/.exec(line);
        if (blocked && Number(blocked[5]) > 0 && blocked[1] === current) {
            const variant = blocked[3].replace(/-/g, '_');
            let group;
            if (blocked[2] === 'websocket') {
                group = 'websocket_other_origin_closed';
            } else if (blocked[4] === 'document') {
                group = 'second_origin_rejected';
            }
            if (group && VARIANTS.includes(variant)) {
                mode[group][variant] = 'blocked';
            }
        }
        const sw = /service worker register\(\): (\w+); script requests seen: (\d+)/.exec(line);
        if (sw) {
            mode.service_workers = {register_attempted: true, script_requests: Number(sw[2])};
        }
        const hits = /second server hits: http (\d+), websocket upgrades (\d+)/.exec(line);
        if (hits) {
            mode.second_server_hits = {http: Number(hits[1]), websocket_upgrades: Number(hits[2])};
        }
        const violations = /^- violations: (\d+)/.exec(line);
        if (violations) {
            mode.violations = Number(violations[1]);
        }
        const after = /^- violations after close: (\d+)/.exec(line);
        if (after) {
            mode.violations_after_close = Number(after[1]);
        }
    }
    return modes;
}

// Reads the config-only containment report of journey mode (guard-journey): one replay-mode section, no race run.
export function parseJourneyReport(markdown) {
    const mode = {second_origin_rejected: {}, websocket_other_origin_closed: {}};
    const outcome = (word) => (word === 'blocked' ? 'blocked' : 'reached');
    for (const line of markdown.split('\n')) {
        const alias = /^- localhost by name .*: (blocked|reached)/.exec(line);
        if (alias) {
            mode.second_origin_rejected.loopback_alias = outcome(alias[1]);
        }
        const http =
            /^- second 127\.0\.0\.1 origin on another port \(HTTP\): (blocked|reached)(?:; server hits: (\d+))?/.exec(
                line,
            );
        if (http) {
            mode.second_origin_rejected.same_host_other_port = outcome(http[1]);
            if (http[2] !== undefined) {
                mode.second_server_hits = {http: Number(http[2])};
            }
        }
        const ws = /^- second 127\.0\.0\.1 origin on another port \(WebSocket\): (blocked|reached)/.exec(line);
        if (ws) {
            mode.websocket_other_origin_closed.same_host_other_port = outcome(ws[1]);
        }
    }
    return {replay: mode};
}

export function parseRaceReport(markdown) {
    const iterations = /iterations completed: (\d+) of (\d+)/.exec(markdown);
    const errors = /iterations with unexpected handler errors: (\d+)/.exec(markdown);
    if (!iterations || !errors) {
        return undefined;
    }
    return {
        iterations_planned: Number(iterations[2]),
        iterations_completed: Number(iterations[1]),
        unexpected_handler_errors: Number(errors[1]),
    };
}

export function buildRecord({guardReport, raceReport, journeyReport, scope}) {
    const race = raceReport === undefined ? undefined : parseRaceReport(raceReport);
    return {
        schema: RECORD_SCHEMA,
        scope: scope ?? {kind: 'engine_only'},
        modes: journeyReport === undefined ? parseGuardReport(guardReport) : parseJourneyReport(journeyReport),
        ...(race ? {race} : {}),
    };
}

export const gate = {
    id: 'containment_evidence',
    run(ctx = {}) {
        return guarded(() => {
            const record = typeof ctx.record === 'string' ? readJsonFile(ctx.record) : ctx.record;
            return checkContainment(record, {specFile: ctx.specFile, minRaceIterations: ctx.minRaceIterations});
        });
    },
};

function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        throw new UsageError(`cannot read ${path.basename(file)}`);
    }
}

async function main() {
    const {positional, values} = parseArgs(process.argv.slice(2), {
        flags: ['spec-as-run'],
        options: ['from-guard-report', 'from-journey-report', 'race', 'spec', 'config', 'spec-file', 'min-race'],
    });
    if (values['from-guard-report'] || values['from-journey-report']) {
        if (values['from-guard-report'] && !values.race) {
            throw new UsageError('--from-guard-report needs --race <guard-race-report.md>');
        }
        let scope;
        if (values['spec-as-run']) {
            if (!values.spec || !values.config) {
                throw new UsageError('--spec-as-run needs --spec and --config');
            }
            scope = {
                kind: 'spec_as_run',
                spec: values.spec,
                spec_sha256: sha256(fs.readFileSync(values.spec)),
                config: values.config,
            };
        }
        const journeyFile = values['from-journey-report'];
        const record = journeyFile
            ? buildRecord({journeyReport: readText(journeyFile), scope})
            : buildRecord({
                  guardReport: readText(values['from-guard-report']),
                  raceReport: readText(values.race),
                  scope,
              });
        printJson(record);
        return 0;
    }
    if (positional.length !== 1) {
        throw new UsageError('usage: containment_evidence.mjs [--spec-file f] [--min-race n] <record.json>');
    }
    const result = gate.run({
        record: positional[0],
        specFile: values['spec-file'],
        minRaceIterations: values['min-race'] ? positiveInt(values['min-race'], '--min-race') : undefined,
    });
    printJson(result);
    return exitCodeFor(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli(main);
}
