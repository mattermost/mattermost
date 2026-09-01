// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {GenericContainer} from 'testcontainers';
import type {WaitStrategy} from 'testcontainers';

import {MATTERMOST_ALIAS, MATTERMOST_PORT, TESTCONTAINERS_LABELS} from './constants';

import {testConfig} from '@/test_config';

const execFileAsync = promisify(execFile);

const MMCTL_ENTRYPOINT = '/mattermost/bin/mmctl';
const MMCTL_CONFIG_DIR = '/tmp/mmctl-xdg';
const MMCTL_CREDENTIALS_NAME = 'e2e';

export type MmctlResult = {
    exitCode: number;
    output: string;
};

// Matches the Credentials/CredentialsList shape mmctl reads (server/cmd/mmctl/commands/auth_utils.go).
// Written directly instead of via `mmctl auth login`, since that needs a password file and this
// image has no shell to create one. AuthMethod "T" treats authToken as a plain bearer token, which
// mmctl reads into Client4.AuthToken.
function buildCredentialsFileContent(username: string, authToken: string): string {
    const credentialsList = {
        [MMCTL_CREDENTIALS_NAME]: {
            name: MMCTL_CREDENTIALS_NAME,
            username,
            authToken,
            authMethod: 'T',
            instanceUrl: `http://${MATTERMOST_ALIAS}:${MATTERMOST_PORT}`,
            active: true,
        },
    };
    return JSON.stringify(credentialsList);
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

// Wait.forOneShotStartup() throws on any non-zero exit code, but a non-zero exit from mmctl is a
// meaningful result to inspect, not a startup failure. This strategy ignores the exit code;
// completion is awaited afterward via `docker wait`.
class NoOpWaitStrategy implements WaitStrategy {
    private startupTimeoutMs = 0;

    async waitUntilReady(): Promise<void> {
        // No-op — completion is awaited by the caller via `docker wait`.
    }

    withStartupTimeout(startupTimeoutMs: number): this {
        this.startupTimeoutMs = startupTimeoutMs;
        return this;
    }

    isStartupTimeoutSet(): boolean {
        return true;
    }

    getStartupTimeout(): number {
        return this.startupTimeoutMs;
    }
}

async function waitForExitCode(containerId: string): Promise<number> {
    // Bounded so a hung mmctl command can't stall cleanup indefinitely.
    const {stdout} = await execFileAsync('docker', ['wait', containerId], {timeout: 60_000});
    return parseInt(stdout.trim(), 10);
}

/**
 * Runs a single mmctl command in its own throwaway container built from the server image, acting
 * as a real remote client rather than the `--local` unix-socket mode used for the server's healthcheck.
 *
 * Joins the network by name (withNetworkMode), not via getNetwork() — this runs in the Playwright
 * worker process, a different OS process from the one that created the network, so getNetwork()'s
 * in-process cache would create a second, unrelated network instead of finding the real one.
 */
export async function runMmctl(args: string[], username: string, authToken: string): Promise<MmctlResult> {
    if (!testConfig.testcontainersNetworkName) {
        throw new Error(
            'No Testcontainers network name available (PW_TESTCONTAINERS_NETWORK_NAME) — is PW_USE_TESTCONTAINERS=true?',
        );
    }

    const container = await new GenericContainer(testConfig.serverImage)
        .withPlatform('linux/amd64') // The published server images are amd64-only.
        .withNetworkMode(testConfig.testcontainersNetworkName)
        .withLabels(TESTCONTAINERS_LABELS)
        .withEnvironment({XDG_CONFIG_HOME: MMCTL_CONFIG_DIR})
        .withCopyContentToContainer([
            {
                content: buildCredentialsFileContent(username, authToken),
                target: `${MMCTL_CONFIG_DIR}/mmctl/config`,
            },
        ])
        .withEntrypoint([MMCTL_ENTRYPOINT])
        .withCommand(args)
        .withWaitStrategy(new NoOpWaitStrategy())
        .withStartupTimeout(60_000)
        .start();

    try {
        const exitCode = await waitForExitCode(container.getId());
        const output = await streamToString(await container.logs());
        return {exitCode, output};
    } finally {
        await container.stop({remove: true});
    }
}
