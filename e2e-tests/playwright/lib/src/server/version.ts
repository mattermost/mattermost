// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {restartMattermostContainer} from '../containers/stack';

import {testConfig} from '@/test_config';

/**
 * Swaps the running Testcontainers-managed Mattermost server to `image`, keeping the same
 * network and Postgres database — i.e. an in-place upgrade (or downgrade) test scenario.
 *
 * Unlike ensureFeatureFlag()/ensureMinio()/etc., which skip the test on a failed precondition
 * (the version/flag/service is incidental to whatever else that test is checking), this throws:
 * for an upgrade spec, the upgrade itself is the thing under test, so failure must fail the test,
 * not silently skip it.
 */
export async function upgradeServerImage(image: string, extraEnv: Record<string, string> = {}): Promise<void> {
    if (!testConfig.useTestContainers) {
        throw new Error('upgradeServerImage requires PW_USE_TESTCONTAINERS=true.');
    }
    testConfig.serverImage = image;
    await restartMattermostContainer(extraEnv);
}
