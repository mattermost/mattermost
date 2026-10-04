// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with the given feature flag(s) set if they aren't already, then verifies
 * the running server reports those values, skipping the test otherwise. Accepts either a single
 * `(flagName, value)` pair or a `{flagName: value}` map.
 *
 * Call via `pw.ensureFeatureFlag(...)`, passing identical arguments across every test in a spec
 * file: when the flags already match, this is a no-op, so the server restarts at most once per
 * file.
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
        let verifyClient = adminClient;
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
            // Restart points the server at a new container, so the pre-restart adminClient is
            // now stale. Fetch a fresh one.
            verifyClient = (await getAdminClient()).adminClient;
        }

        const restartedConfig = await verifyClient.getConfig();
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
