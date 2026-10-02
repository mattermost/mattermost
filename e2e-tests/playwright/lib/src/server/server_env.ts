// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {bootEnvMatches, restartMattermostContainer} from '../containers/stack';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';

/**
 * Restarts the server with a single MM_* env var set to `value` if it isn't already, for boot-only
 * settings that can't be changed via patchConfig on a running server.
 *
 * Only checks bootEnvOverrides bookkeeping, not the server's actual reported config, so keys
 * always recomputed by structuralEnv() (mattermost_container.ts) win over this regardless — a
 * caller touching one of those needs its own post-restart check.
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
 * Points ServiceSettings.SiteURL at the host-reachable baseURL, which SSO redirects need, and
 * confirms the server reports it, skipping the test otherwise.
 *
 * It lasts until the next initSetup(), whose default config puts SiteURL back to
 * internalBaseURL: the server has to reach itself at its SiteURL to embed permalink previews and
 * call plugins back for interactive dialogs and buttons, and it can't reach the host-mapped port.
 */
export async function ensureSiteUrl(): Promise<void> {
    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - a host-facing SiteURL requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    try {
        const {adminClient} = await getAdminClient();
        await adminClient.patchConfig({ServiceSettings: {SiteURL: testConfig.baseURL}});

        const config = await adminClient.getConfig();
        if (config.ServiceSettings.SiteURL !== testConfig.baseURL) {
            throw new Error(
                `ServiceSettings.SiteURL is "${config.ServiceSettings.SiteURL}", expected "${testConfig.baseURL}". ` +
                    'A stack started before SiteURL moved out of the boot env pins it; run `npm run testcontainers:down`.',
            );
        }
    } catch (error) {
        test.skip(true, `Skipping test - SiteURL check failed: ${String(error)}`);
    }
}

/**
 * The SiteURL the server currently runs with: the origin a permalink must use for the server to
 * recognize it as its own and embed a preview. It is testConfig.internalBaseURL unless the test
 * called ensureSiteUrl().
 */
export async function getSiteUrl(adminClient: Client4): Promise<string> {
    const config = await adminClient.getConfig();
    return config.ServiceSettings.SiteURL;
}
