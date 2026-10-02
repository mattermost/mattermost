// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with the given feature flag(s) set to their requested values if they
 * aren't already, and confirms the running server reports those values, skipping the test
 * otherwise.
 *
 * Accepts either a single `(flagName, value)` pair or a `{flagName: value, ...}` object. Passing
 * several flags in one call checks them all before deciding whether to restart, and — if needed —
 * restarts the server once with every mismatched flag applied together, instead of one restart
 * per flag. Prefer the object form whenever a test needs more than one flag set, since calling
 * this function repeatedly with single flags can trigger a restart per call.
 *
 * FeatureFlags can't be changed via patchConfig on a running server: with no Split key configured,
 * the config store's readOnlyFF handling reverts any FeatureFlags patch, so only a boot-time
 * MM_FEATUREFLAGS_* env var takes effect.
 */
export async function ensureFeatureFlag(flagName: string, value: boolean): Promise<void>;
export async function ensureFeatureFlag(flags: Record<string, boolean>): Promise<void>;
export async function ensureFeatureFlag(flagNameOrFlags: string | Record<string, boolean>, value?: boolean) {
    const flags: Record<string, boolean> =
        typeof flagNameOrFlags === 'string' ? {[flagNameOrFlags]: value as boolean} : flagNameOrFlags;
    const flagNames = Object.keys(flags).join(', ');

    try {
        const {adminClient} = await getAdminClient();
        const config = await adminClient.getConfig();

        const mismatched = Object.entries(flags).filter(
            ([flagName, value]) => String(config.FeatureFlags?.[flagName]) !== String(value),
        );
        if (mismatched.length === 0) {
            // Already matches - nothing to restart, even against an external server.
            return;
        }

        if (!testConfig.useTestContainers) {
            test.skip(true, 'Skipping test - feature flag restart requires PW_USE_TESTCONTAINERS=true');
            return;
        }

        const env: Record<string, string> = {};
        for (const [flagName, value] of mismatched) {
            env[`MM_FEATUREFLAGS_${flagName.toUpperCase()}`] = String(value);
        }
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const restartedConfig = await adminClient.getConfig();
        for (const [flagName, value] of mismatched) {
            const actual = restartedConfig.FeatureFlags?.[flagName];
            if (String(actual) !== String(value)) {
                throw new Error(
                    `Feature flag "${flagName}" is "${String(actual)}" after restart, expected "${String(value)}".`,
                );
            }
        }
    } catch (error) {
        test.skip(true, `Skipping test - feature flag(s) "${flagNames}" check failed: ${String(error)}`);
    }
}
