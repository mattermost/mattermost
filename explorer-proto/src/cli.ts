// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Usage: node explorer-proto/src/cli.ts <explore|emit|replay|guard-check|guard-race|probe-absence> [--out=<dir>] [-- <playwright args>]
import {spawnSync} from 'node:child_process';
import path from 'node:path';

import {emit} from './emit.ts';
import {CONFIG_PATH, PLAYWRIGHT_DIR, PROTO_DIR, outDir} from './paths.ts';

const [command, ...rest] = process.argv.slice(2);
const separator = rest.indexOf('--');
const own = separator >= 0 ? rest.slice(0, separator) : rest;
const passthrough = separator >= 0 ? rest.slice(separator + 1) : [];
const outArg = own.find((a) => a.startsWith('--out='));
if (outArg) {
    process.env.EXPLORER_OUT_DIR = path.resolve(outArg.slice('--out='.length));
}

function playwright(mode: string): number {
    // The license never needs to reach Playwright or the browser.
    const env: NodeJS.ProcessEnv = {...process.env, EXPLORER_MODE: mode, EXPLORER_OUT_DIR: outDir()};
    delete env.MM_LICENSE;
    delete env.PW_USE_TESTCONTAINERS;
    const bin = path.join(PLAYWRIGHT_DIR, 'node_modules', '.bin', 'playwright');
    const result = spawnSync(bin, ['test', '-c', CONFIG_PATH, ...passthrough], {cwd: PROTO_DIR, env, stdio: 'inherit'});
    return result.status ?? 1;
}

async function main(): Promise<number> {
    switch (command) {
        case 'explore':
            return playwright('explore');
        case 'emit': {
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
            return playwright('replay');
        case 'guard-check':
            return playwright('guard-check');
        case 'guard-race':
            return playwright('guard-race');
        case 'probe-absence':
            return playwright('probe-absence');
        default:
            process.stderr.write(
                'usage: node explorer-proto/src/cli.ts <explore|emit|replay|guard-check|guard-race|probe-absence> [--out=<dir>]\n',
            );
            return 2;
    }
}

process.exit(await main());
