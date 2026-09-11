// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with a single MM_* env var set to `value` if it isn't already - the same
 * boot-only-setting restart ensureFeatureFlag()/ensureMinio() use, generalized to an arbitrary
 * key, for settings that only take effect at boot and can't be changed via patchConfig on a
 * running server.
 *
 * Only checks bootEnvOverrides bookkeeping (what this process asked for), not the server's
 * actual reported config. That's fine for most boot-only settings, but a few keys (see
 * mattermost_container.ts's structuralEnv()) are always recomputed by the container startup code
 * itself and win over anything passed here regardless, so this can't be used to change them - a
 * caller touching one of those needs its own post-restart check against the real config to catch
 * that rather than trusting this function silently worked.
 */
export async function ensureServerEnv(key: string, value: string): Promise<void> {
    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - server env restart requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    try {
        const env = {[key]: value};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }
    } catch (error) {
        test.skip(true, `Skipping test - server env "${key}" restart failed: ${String(error)}`);
    }
}

/**
 * Restarts the server with ServiceSettings.SiteURL set to the host-reachable baseURL, if it
 * isn't already, and confirms the running server actually reports that value - skipping the test
 * otherwise, instead of failing on an unmet precondition.
 *
 * Unlike most boot-only settings, this one persists once set: restartMattermostContainer() merges
 * env rather than replacing it, so every other spec sharing this reused server afterward also
 * sees the host-facing SiteURL until something restarts it back to the alias (see
 * env_baseline.ts). Only call this from a spec that genuinely needs a host-reachable SiteURL for
 * the rest of the run (e.g. an OAuth-style flow a plain browser must be able to follow) - not
 * something to reach for casually.
 */
export async function ensureSiteUrl(): Promise<void> {
    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - SiteURL restart requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    try {
        const env = {MM_SERVICESETTINGS_SITEURL: testConfig.baseURL};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient} = await getAdminClient();
        const config = await adminClient.getConfig();
        if (config.ServiceSettings.SiteURL !== testConfig.baseURL) {
            throw new Error(
                `ServiceSettings.SiteURL is "${config.ServiceSettings.SiteURL}" after restart, expected ` +
                    `"${testConfig.baseURL}".`,
            );
        }
    } catch (error) {
        test.skip(true, `Skipping test - SiteURL check failed: ${String(error)}`);
    }
}
