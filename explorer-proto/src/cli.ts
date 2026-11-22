// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Usage: node explorer-proto/src/cli.ts <explore|emit|replay|guard-check|guard-race|guard-journey|containment-evidence|probe-absence|journey-selftest|engine-hash|charter-hash|charter-check> [--session=<name>] [--out=<dir>] [-- <playwright args>]
import {spawn, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {charterPath} from './charter.ts';
import {startContainmentProxy} from './containment_proxy.ts';
import {buildEvidenceRecord, readFragment, writeJson} from './containment_report.ts';
import type {RaceFragment} from './containment_report.ts';
import {SCRATCH_SPEC_NAME} from './containment_scratch.ts';
import {emit} from './emit.ts';
import {emitJourney} from './emit_journey.ts';
import {emitSession} from './emit_session.ts';
import {engineHash} from './engine_hash.ts';
import {freePort, runGuardJourney} from './guard_journey_run.ts';
import {charterFileSha256, readJourneyCharter} from './journey_charter.ts';
import {PROXY_PORT_ENV} from './journey_containment.ts';
import {clientConfigRequestPath} from './journey_fixture.ts';
import {hasOutcomes, validateOutcomeCharter} from './journey_outcomes.ts';
import {allowedOrigin} from './manifest.ts';
import {
    CONFIG_PATH,
    PLAYWRIGHT_DIR,
    PROTO_DIR,
    REPO_DIR,
    REPORTS_DIR,
    SCRATCH_DIR,
    journeyName,
    outDir,
    reportsDir,
    sessionName,
} from './paths.ts';

const [command, ...rest] = process.argv.slice(2);
const separator = rest.indexOf('--');
const own = separator >= 0 ? rest.slice(0, separator) : rest;
const passthrough = separator >= 0 ? rest.slice(separator + 1) : [];
const outArg = own.find((a) => a.startsWith('--out='));
if (outArg) {
    process.env.EXPLORER_OUT_DIR = path.resolve(outArg.slice('--out='.length));
}
const sessionArg = own.find((a) => a.startsWith('--session='));
delete process.env.PILOT_SESSION;
if (sessionArg) {
    process.env.PILOT_SESSION = sessionArg.slice('--session='.length);
}
const journeyArg = own.find((a) => a.startsWith('--journey='));
delete process.env.PILOT_JOURNEY;
if (journeyArg) {
    process.env.PILOT_JOURNEY = journeyArg.slice('--journey='.length);
}
const SESSION_COMMANDS = ['explore', 'emit', 'replay', 'charter-hash'];
const JOURNEY_COMMANDS = [
    'explore',
    'emit',
    'replay',
    'guard-journey',
    'containment-evidence',
    'charter-hash',
    'charter-check',
];

const PLAYWRIGHT_BIN = path.join(PLAYWRIGHT_DIR, 'node_modules', '.bin', 'playwright');

function childEnv(mode: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    // The license never needs to reach Playwright or the browser.
    const env: NodeJS.ProcessEnv = {...process.env, ...extra, EXPLORER_MODE: mode, EXPLORER_OUT_DIR: outDir()};
    delete env.MM_LICENSE;
    delete env.PW_USE_TESTCONTAINERS;
    return env;
}

function playwright(mode: string): number {
    const result = spawnSync(PLAYWRIGHT_BIN, ['test', '-c', CONFIG_PATH, ...passthrough], {
        cwd: PROTO_DIR,
        env: childEnv(mode),
        stdio: 'inherit',
    });
    return result.status ?? 1;
}

/** Asynchronous so that servers in this process (the containment proxy) keep serving while Playwright runs. */
function playwrightAsync(mode: string, extra: NodeJS.ProcessEnv = {}): Promise<number> {
    return new Promise((resolve) => {
        const child = spawn(PLAYWRIGHT_BIN, ['test', '-c', CONFIG_PATH, ...passthrough], {
            cwd: PROTO_DIR,
            env: childEnv(mode, extra),
            stdio: 'inherit',
        });
        child.on('exit', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
    });
}

/**
 * Runs replay-journey with every browser request sent through a local filtering proxy that only forwards the
 * approved origin. The proxy port exists only in this process and the child env, never in a written artifact.
 */
async function replayJourneyContained(): Promise<number> {
    const approved = new URL(allowedOrigin());
    const proxy = await startContainmentProxy({host: approved.hostname, port: Number(approved.port)});
    try {
        return await playwrightAsync('replay-journey', {[PROXY_PORT_ENV]: String(proxy.port)});
    } finally {
        await proxy.close();
        const {allowedHttp, allowedTunnels, allowedUpgrades, refused, refusedByCategory, upstreamSocketsOpened} =
            proxy.stats;
        process.stdout.write(
            `containment proxy: forwarded ${allowedHttp} HTTP request(s) and ${allowedTunnels + allowedUpgrades} tunnel(s); refused ${refused} ${JSON.stringify(refusedByCategory)}; upstream sockets ${upstreamSocketsOpened}\n`,
        );
    }
}

/** Replay passes only if at least one test ran and every test passed; a skip is not a pass. */
function judgeReplay(status: number, reportName: string, label: string): number {
    const report = path.join(reportsDir(), `${reportName}.json`);
    const stats = JSON.parse(fs.readFileSync(report, 'utf-8')).stats as Record<string, number>;
    const verdict = status === 0 && stats.expected > 0 && !stats.unexpected && !stats.skipped && !stats.flaky;
    process.stdout.write(
        `${label}: ${verdict ? 'PASS' : 'FAIL'} (${stats.expected} passed, ${stats.unexpected} failed, ${stats.skipped} skipped, ${stats.flaky} flaky)\n`,
    );
    return verdict ? 0 : 1;
}

/** Composes the gate input from the last guard-check, guard-race and guard-journey runs; writes nothing if any run failed. */
function containmentEvidence(): number {
    const specArg = own.find((a) => a.startsWith('--spec='));
    const spec = path.resolve(specArg ? specArg.slice('--spec='.length) : path.join(SCRATCH_DIR, SCRATCH_SPEC_NAME));
    const record = buildEvidenceRecord({
        check: readFragment(path.join(REPORTS_DIR, 'guard-check.fragment.json')),
        race: JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'guard-race.fragment.json'), 'utf8')) as RaceFragment,
        journey: readFragment(path.join(reportsDir(), 'guard-journey.fragment.json')),
        spec: {
            path: path.relative(REPO_DIR, spec),
            sha256: crypto.createHash('sha256').update(fs.readFileSync(spec)).digest('hex'),
        },
        config: path.relative(REPO_DIR, CONFIG_PATH),
    });
    const file = path.join(outDir(), 'containment-evidence.json');
    writeJson(file, record);
    process.stdout.write(`containment-evidence: wrote ${path.relative(REPO_DIR, file)}\n`);
    return 0;
}

/**
 * Offline outcome-mode selftest: a loopback fake app (synthetic charters only, no stack). The port is chosen
 * here and handed to the child through the environment; it is never printed.
 */
async function journeySelftest(): Promise<number> {
    const port = await freePort();
    const status = await playwrightAsync('journey-selftest', {
        PW_BASE_URL: `http://127.0.0.1:${port}`,
        EXPLORER_SELFTEST_PORT: String(port),
    });
    const report = path.join(reportsDir(), 'journey-selftest.json');
    if (fs.existsSync(report)) {
        const stats = JSON.parse(fs.readFileSync(report, 'utf-8')).stats as Record<string, number>;
        process.stdout.write(
            `journey-selftest: ${status === 0 ? 'PASS' : 'FAIL'} (${stats.expected} passed, ${stats.unexpected} failed, ${stats.skipped} skipped, ${stats.flaky} flaky)\n`,
        );
    }
    return status;
}

async function main(): Promise<number> {
    const session = sessionName();
    const journey = journeyName();
    if (session && !SESSION_COMMANDS.includes(command)) {
        process.stderr.write(`--session is only supported for ${SESSION_COMMANDS.join(', ')}\n`);
        return 2;
    }
    if (journey && !JOURNEY_COMMANDS.includes(command)) {
        process.stderr.write(`--journey is only supported for ${JOURNEY_COMMANDS.join(', ')}\n`);
        return 2;
    }
    if (journey && session) {
        process.stderr.write('--journey and --session are mutually exclusive\n');
        return 2;
    }
    if (own.includes('--charter-hash') || command === 'charter-hash') {
        const name = journey || session;
        if (!name) {
            process.stderr.write('--charter-hash needs --journey=<name> or --session=<name>\n');
            return 2;
        }
        process.stdout.write(`${charterFileSha256(name)}  ${path.relative(REPO_DIR, charterPath(name))}\n`);
        if (command === 'charter-hash') {
            return 0;
        }
    }
    switch (command) {
        case 'engine-hash': {
            const {files, listing, sha256} = engineHash();
            if (own.includes('--list')) {
                process.stdout.write(listing);
            }
            process.stdout.write(`engine-sha256 ${sha256} (${files.length} files)\n`);
            return 0;
        }
        case 'charter-check': {
            if (!journey) {
                process.stderr.write('charter-check needs --journey=<name>\n');
                return 2;
            }
            const charter = readJourneyCharter(journey);
            if (!hasOutcomes(charter)) {
                process.stdout.write(`${journey}: no success_criteria.outcomes; nothing to check\n`);
                return 0;
            }
            const rules = validateOutcomeCharter(charter);
            process.stdout.write(
                [
                    `${journey}: outcome rules parsed`,
                    ...rules.classes.map(
                        (c) => `  class ${c.name}: ${c.clauses.map((x) => `${x.checkpoint}=${x.value}`).join(' AND ')}`,
                    ),
                    ...rules.precedence.map(
                        (r) =>
                            `  precedence ${r.label}: ${r.conditions.map((c) => ('cls' in c ? `${c.kind}(${c.cls})` : c.kind)).join(' AND ')}`,
                    ),
                    `  confirmation order: ${rules.confirmOrder.join(', ')}; preserved: ${rules.preserveClasses.join(', ')}; no_early_stop: ${rules.noEarlyStop}; reserved replays: ${rules.reserved}`,
                    `  precondition source: ${clientConfigRequestPath(charter) ? 'client config' : 'admin GET /config'}`,
                    '',
                ].join('\n'),
            );
            return 0;
        }
        case 'journey-selftest':
            return journeySelftest();
        case 'explore':
            return playwright(journey ? 'explore-journey' : 'explore');
        case 'emit': {
            if (journey) {
                const e = await emitJourney(journey);
                process.stdout.write(`${journey}: ${e.status}${e.file ? ` -> ${e.file}` : ''}\n`);
                for (const line of [...e.reasons, ...e.steps.map((s) => `step: ${s}`)]) {
                    process.stdout.write(`  ${line}\n`);
                }
                return e.status === 'emitted' ? 0 : 1;
            }
            if (session) {
                const e = await emitSession(session, outDir());
                process.stdout.write(`${session}: ${e.status}${e.file ? ` -> ${e.file}` : ''}\n`);
                for (const line of [...e.reasons, ...e.steps.map((s) => `step: ${s}`)]) {
                    process.stdout.write(`  ${line}\n`);
                }
                return e.status === 'emitted' ? 0 : 1;
            }
            const records = await emit(outDir());
            for (const r of records) {
                process.stdout.write(`${r.scenario}: ${r.status}${r.file ? ` -> ${r.file}` : ''}\n`);
                for (const reason of r.reasons) {
                    process.stdout.write(`  ${reason}\n`);
                }
                for (const check of r.locatorChecks.filter((c) => c.startsWith('WARNING'))) {
                    process.stdout.write(`  ${check}\n`);
                }
            }
            return records.some((r) => r.status === 'stopped') ? 1 : 0;
        }
        case 'replay':
            if (journey) {
                return judgeReplay(await replayJourneyContained(), 'replay-journey', 'journey replay');
            }
            return session ? judgeReplay(playwright('replay'), 'replay', 'session replay') : playwright('replay');
        case 'guard-check':
            return playwright('guard-check');
        case 'guard-race':
            return playwright('guard-race');
        case 'guard-journey':
            return runGuardJourney(playwrightAsync);
        case 'containment-evidence':
            return containmentEvidence();
        case 'probe-absence':
            return playwright('probe-absence');
        default:
            process.stderr.write(
                'usage: node explorer-proto/src/cli.ts <explore|emit|replay|guard-check|guard-race|guard-journey|containment-evidence|probe-absence|journey-selftest|engine-hash|charter-hash|charter-check> [--session=<name>|--journey=<name>] [--out=<dir>] [--charter-hash]\n',
            );
            return 2;
    }
}

process.exit(await main());
