// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {runMmctl as runMmctlContainer} from '../containers/mmctl_container';
import type {MmctlResult} from '../containers/mmctl_container';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

export type {MmctlResult};

/**
 * Runs an mmctl command as a real remote client: a separate container built from the same server
 * image, authenticated with the current admin session, reaching the server over the
 * Testcontainers network rather than the `--local` unix socket the server's own container uses.
 */
export async function runMmctl(args: string[]): Promise<MmctlResult> {
    const {adminClient, adminUser} = await getAdminClient();
    if (!adminUser) {
        throw new Error('No admin user available to authenticate mmctl with.');
    }
    return runMmctlContainer(args, adminUser.username, adminClient.getToken());
}

/**
 * Checks full (Testcontainers) mode is active and a real remote mmctl invocation actually reaches
 * the server — skipping the test otherwise, instead of failing on an unmet precondition.
 */
export async function ensureMmctl(): Promise<void> {
    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - remote mmctl container requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    try {
        const result = await runMmctl(['version']);
        if (result.exitCode !== 0) {
            throw new Error(`mmctl exited with code ${result.exitCode}: ${result.output}`);
        }
    } catch (error) {
        test.skip(true, `Skipping test - mmctl connectivity check failed: ${String(error)}`);
    }
}
