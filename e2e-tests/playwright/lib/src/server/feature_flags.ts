// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with the given feature flag set to `value` if it isn't already, and
 * confirms the running server actually reports that value — skipping the test otherwise, instead
 * of failing on an unmet precondition.
 *
 * FeatureFlags can't be changed via patchConfig on a running server at all: with no Split key
 * configured (this test setup never sets one), the config store's readOnlyFF handling reverts any
 * FeatureFlags patch back to its prior value before it's even persisted
 * (server/config/store.go's Set()/Load()), so only a boot-time MM_FEATUREFLAGS_* env var actually
 * takes effect.
 */
export async function ensureFeatureFlag(flagName: string, value: boolean): Promise<void> {
    const envValue = String(value);
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getConfig();
    if (String(config.FeatureFlags?.[flagName]) === envValue) {
        // Already matches - nothing to restart, even against an external server.
        return;
    }

    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - feature flag restart requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    const envKey = `MM_FEATUREFLAGS_${flagName.toUpperCase()}`;

    try {
        const env = {[envKey]: envValue};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const restartedConfig = await adminClient.getConfig();
        const actual = restartedConfig.FeatureFlags?.[flagName];
        if (String(actual) !== envValue) {
            throw new Error(`Feature flag "${flagName}" is "${String(actual)}" after restart, expected "${envValue}".`);
        }
    } catch (error) {
        test.skip(true, `Skipping test - feature flag "${flagName}" check failed: ${String(error)}`);
    }
}
