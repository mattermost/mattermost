// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {Network} from 'testcontainers';
import type {StartedNetwork} from 'testcontainers';

import {logTestcontainers, warnTestcontainers} from './log';

const execFileAsync = promisify(execFile);

// One bridge network per Playwright invocation, shared by every container it starts. When
// Playwright itself runs inside a container, that container also joins this network so it can
// reach everything by alias instead of a mapped port.
let startedNetwork: StartedNetwork | undefined;

export async function getNetwork(): Promise<StartedNetwork> {
    if (!startedNetwork) {
        logTestcontainers('creating network...');
        startedNetwork = await new Network().start();
        logTestcontainers('network created.');
    }
    return startedNetwork;
}

/**
 * The bridge network's gateway IP (e.g. 172.18.0.1) — a real address bound to an interface on the
 * Docker host itself, so a process listening on 0.0.0.0 on the host is reachable both from the
 * host directly and from any container on this network, without a network alias or mapped port.
 * Takes a network id/name rather than a StartedNetwork object so it also works from
 * reuseExistingStack(), which only has testConfig's network name.
 */
export async function getNetworkGatewayIp(network: string): Promise<string> {
    const {stdout} = await execFileAsync('docker', [
        'network',
        'inspect',
        network,
        '--format',
        '{{(index .IPAM.Config 0).Gateway}}',
    ]);
    return stdout.trim();
}

export async function stopNetwork(): Promise<void> {
    if (!startedNetwork) {
        return;
    }

    const network = startedNetwork;
    startedNetwork = undefined;

    // A container a worker process swapped in via restartMattermostContainer() (a different OS
    // process, invisible to this one) can still be mid-detach from the network at this exact
    // moment, which Docker reports as "has active endpoints". Ryuk removes the network anyway
    // once that settles, so retry briefly rather than surfacing a scary but harmless error.
    const attempts = 5;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await network.stop();
            return;
        } catch (error) {
            if (attempt === attempts) {
                warnTestcontainers(
                    `could not remove network ${network.getId()} (Ryuk will remove it shortly): ${String(error)}`,
                );
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
