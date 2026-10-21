// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import net from 'node:net';

import {logTestcontainers} from './log';
import {describeDockerPortHolder} from './orphans';
import {NonRetryableError} from './retry';

import {duration, wait} from '@/util';

function isBindable(port: number, host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        // Only "in use" means taken; an unsupported address family (e.g. no IPv6) is not a conflict.
        server.once('error', (error: NodeJS.ErrnoException) => resolve(error.code !== 'EADDRINUSE'));
        server.listen({port, host, exclusive: true}, () => server.close(() => resolve(true)));
    });
}

/**
 * Waits until nothing holds `port` on the host, and throws (without retrying) naming the holder if something still does. Docker can keep a removed container's published port allocated
 * for a moment, so starting the replacement immediately fails with "port is already allocated".
 */
export async function waitForHostPortFree(port: number, timeout = duration.half_min): Promise<void> {
    const startedAt = Date.now();
    let waited = false;

    for (;;) {
        const free = (await isBindable(port, '0.0.0.0')) && (await isBindable(port, '::'));
        if (free) {
            if (waited) {
                logTestcontainers(`host port ${port} free after ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
            }
            return;
        }
        if (Date.now() - startedAt > timeout) {
            const holder = await describeDockerPortHolder(port);
            throw new NonRetryableError(
                `Host port ${port} is still in use after ${timeout / 1000}s, held by ` +
                    `${holder ?? `a process outside Docker (see: lsof -nP -iTCP:${port} -sTCP:LISTEN)`}. ` +
                    'Stop it or run "npm run testcontainers:down", then retry.',
            );
        }
        waited = true;

        await wait(duration.half_sec);
    }
}
