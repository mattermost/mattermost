// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {restartMattermostContainer} from '../containers/stack';
import {logTestcontainers} from '../containers/log';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';
import {duration} from '@/util';

const execFileAsync = promisify(execFile);

export type UpgradeServerImageOptions = {
    /** Skip host `MM_LICENSE` on the restarted container (license must survive from Postgres). */
    omitProcessEnvLicense?: boolean;
};

/**
 * Swaps the running Testcontainers-managed Mattermost server to `image`, keeping the same
 * network and Postgres database — i.e. an in-place upgrade (or downgrade) test scenario.
 *
 * Unlike ensureFeatureFlag()/ensureMinio()/etc., which skip the test on a failed precondition
 * (the version/flag/service is incidental to whatever else that test is checking), this throws:
 * for an upgrade spec, the upgrade itself is the thing under test, so failure must fail the test,
 * not silently skip it.
 */
export async function upgradeServerImage(
    image: string,
    extraEnv: Record<string, string> = {},
    options: UpgradeServerImageOptions = {},
): Promise<void> {
    if (!testConfig.useTestContainers) {
        throw new Error('upgradeServerImage requires PW_USE_TESTCONTAINERS=true.');
    }

    const fromImage = testConfig.serverImage;
    logTestcontainers(`upgrade swap: ${fromImage} → ${image}`);

    const previousOmitLicense = testConfig.omitProcessEnvLicense;
    if (options.omitProcessEnvLicense) {
        testConfig.omitProcessEnvLicense = true;
        const bootEnvWithoutLicense = {...testConfig.bootEnvOverrides};
        delete bootEnvWithoutLicense.MM_LICENSE;
        testConfig.bootEnvOverrides = bootEnvWithoutLicense;
    }

    try {
        testConfig.serverImage = image;
        await restartMattermostContainer(extraEnv);
        await assertRunningContainerImage(image);
        await waitForServerApiReady();
        logTestcontainers(`upgrade swap complete — server ready at ${testConfig.baseURL} (${image}).`);
    } finally {
        testConfig.omitProcessEnvLicense = previousOmitLicense;
    }
}

async function assertRunningContainerImage(expectedImage: string): Promise<void> {
    if (!testConfig.mattermostContainerId) {
        throw new Error('Missing Mattermost container id after image swap.');
    }

    const {stdout} = await execFileAsync('docker', [
        'inspect',
        testConfig.mattermostContainerId,
        '--format',
        '{{.Config.Image}}',
    ]);
    const runningImage = stdout.trim();
    const expectedTag = expectedImage.includes(':') ? expectedImage.slice(expectedImage.lastIndexOf(':') + 1) : expectedImage;

    if (!runningImage.includes(expectedTag) && runningImage !== expectedImage) {
        throw new Error(
            `Upgrade swap expected container image "${expectedImage}" but docker reports "${runningImage}".`,
        );
    }
}

async function waitForServerApiReady(): Promise<void> {
    const deadline = Date.now() + duration.four_min;
    while (Date.now() < deadline) {
        const {adminUser} = await getAdminClient({skipLog: true});
        if (adminUser) {
            return;
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Server API did not become ready after image swap.');
}
