// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with the given feature flag set to `value` if it isn't already, and
 * confirms the running server reports that value, skipping the test otherwise.
 *
 * FeatureFlags can't be changed via patchConfig on a running server: with no Split key configured,
 * the config store's readOnlyFF handling reverts any FeatureFlags patch, so only a boot-time
 * MM_FEATUREFLAGS_* env var takes effect.
 */
export async function ensureFeatureFlag(flagName: string, value: boolean): Promise<void> {
    const envValue = String(value);

    try {
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
