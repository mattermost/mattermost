// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with the given feature flag(s) set to their desired values if they
 * aren't already, and confirms the running server reports those values, skipping the test
 * otherwise.
 *
 * Accepts either a single `(flagName, value)` pair or a `{flagName: value}` map so multiple
 * prerequisite flags can be combined into a single restart instead of one per flag.
 *
 * FeatureFlags can't be changed via patchConfig on a running server: with no Split key configured,
 * the config store's readOnlyFF handling reverts any FeatureFlags patch, so only a boot-time
 * MM_FEATUREFLAGS_* env var takes effect.
 */
export async function ensureFeatureFlag(flagName: string, value: boolean): Promise<void>;
export async function ensureFeatureFlag(flags: Record<string, boolean>): Promise<void>;
export async function ensureFeatureFlag(
    flagNameOrFlags: string | Record<string, boolean>,
    value?: boolean,
): Promise<void> {
    const flags = typeof flagNameOrFlags === 'string' ? {[flagNameOrFlags]: value as boolean} : flagNameOrFlags;
    const flagEntries = Object.entries(flags);
    const describeFlags = () => flagEntries.map(([name, val]) => `${name}=${String(val)}`).join(', ');

    try {
        const {adminClient} = await getAdminClient();
        const config = await adminClient.getConfig();

        const mismatched = flagEntries.filter(
            ([flagName, flagValue]) => String(config.FeatureFlags?.[flagName]) !== String(flagValue),
        );
        if (mismatched.length === 0) {
            // Already matches - nothing to restart, even against an external server.
            return;
        }

        if (!testConfig.useTestContainers) {
            test.skip(true, 'Skipping test - feature flag restart requires PW_USE_TESTCONTAINERS=true');
            return;
        }

        const env = Object.fromEntries(
            mismatched.map(([flagName, flagValue]) => [`MM_FEATUREFLAGS_${flagName.toUpperCase()}`, String(flagValue)]),
        );
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const restartedConfig = await adminClient.getConfig();
        for (const [flagName, flagValue] of mismatched) {
            const actual = restartedConfig.FeatureFlags?.[flagName];
            if (String(actual) !== String(flagValue)) {
                throw new Error(
                    `Feature flag "${flagName}" is "${String(actual)}" after restart, expected "${String(flagValue)}".`,
                );
            }
        }
    } catch (error) {
        test.skip(true, `Skipping test - feature flag check (${describeFlags()}) failed: ${String(error)}`);
    }
}
