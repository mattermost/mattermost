// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Usage: node explorer-proto/src/cli.ts <explore|emit|replay|guard-check|guard-race|probe-absence> [--session=<name>] [--out=<dir>] [-- <playwright args>]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {emit} from './emit.ts';
import {emitJourney} from './emit_journey.ts';
import {emitSession} from './emit_session.ts';
import {CONFIG_PATH, PLAYWRIGHT_DIR, PROTO_DIR, journeyName, outDir, reportsDir, sessionName} from './paths.ts';

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
const SESSION_COMMANDS = ['explore', 'emit', 'replay'];
const JOURNEY_COMMANDS = ['explore', 'emit', 'replay', 'guard-journey'];

function playwright(mode: string): number {
    // The license never needs to reach Playwright or the browser.
    const env: NodeJS.ProcessEnv = {...process.env, EXPLORER_MODE: mode, EXPLORER_OUT_DIR: outDir()};
    delete env.MM_LICENSE;
    delete env.PW_USE_TESTCONTAINERS;
    const bin = path.join(PLAYWRIGHT_DIR, 'node_modules', '.bin', 'playwright');
    const result = spawnSync(bin, ['test', '-c', CONFIG_PATH, ...passthrough], {cwd: PROTO_DIR, env, stdio: 'inherit'});
    return result.status ?? 1;
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
    switch (command) {
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
                return judgeReplay(playwright('replay-journey'), 'replay-journey', 'journey replay');
            }
            return session ? judgeReplay(playwright('replay'), 'replay', 'session replay') : playwright('replay');
        case 'guard-check':
            return playwright('guard-check');
        case 'guard-race':
            return playwright('guard-race');
        case 'guard-journey':
            return playwright('guard-journey');
        case 'probe-absence':
            return playwright('probe-absence');
        default:
            process.stderr.write(
                'usage: node explorer-proto/src/cli.ts <explore|emit|replay|guard-check|guard-race|guard-journey|probe-absence> [--session=<name>|--journey=<name>] [--out=<dir>]\n',
            );
            return 2;
    }
}

process.exit(await main());
