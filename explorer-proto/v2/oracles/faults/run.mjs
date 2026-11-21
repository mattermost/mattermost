// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env, no-process-exit -- CLI script: the repo config relaxes these for .ts/.js only */
// SYNTHETIC fault injection proxy. Usage:
//   node explorer-proto/v2/oracles/faults/run.mjs --config=<file.json> [--upstream-port=<forwarder port>]
//        [--site-origin=<origin>] [--log=<fault-log.jsonl>] [--port-file=<file>]
// Refuses to start unless the config has "enabled": true. The listening port is written to --port-file
// (never printed); point the explorer at it with PW_BASE_URL=http://127.0.0.1:<port>.
import fs from 'node:fs';

import {startFaultProxy} from './fault-proxy.ts';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const configPath = arg('config');
if (!configPath) {
    process.stderr.write(
        'usage: run.mjs --config=<file.json> [--upstream-port=N] [--site-origin=URL] [--log=F] [--port-file=F]\n',
    );
    process.exit(2);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const upstreamPort = Number(arg('upstream-port') ?? process.env.PILOT_PORT ?? 8065);

let proxy;
try {
    proxy = await startFaultProxy({config, upstreamPort, siteOrigin: arg('site-origin'), logPath: arg('log')});
} catch (error) {
    process.stderr.write(`fault-proxy: ${error.message}\n`);
    process.exit(1);
}
if (arg('port-file')) {
    fs.writeFileSync(arg('port-file'), String(proxy.port));
}
process.stdout.write(`fault-proxy: SYNTHETIC fault injection ACTIVE (${config.rules.length} rules, loopback only)\n`);
const stop = async () => {
    await proxy.close();
    process.stdout.write(`fault-proxy: stopped; ${proxy.log.length} SYNTHETIC-INJECTED activations\n`);
    process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
