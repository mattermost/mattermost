// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@playwright/test';

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
 * Restarts the server with ServiceSettings.SiteURL set to the host-reachable baseURL, if it
 * isn't already, and confirms the running server reports that value, skipping the test otherwise.
 *
 * This persists once set: restartMattermostContainer() merges env, so every spec sharing this
 * reused server afterward also sees the host-facing SiteURL. Only call this when a spec genuinely
 * needs a host-reachable SiteURL.
 */
export async function ensureSiteUrl(): Promise<void> {
    await ensureSiteUrlValue(testConfig.baseURL);
}

/**
 * Restarts the server with ServiceSettings.SiteURL back at internalBaseURL — the address the
 * server's own container can reach itself on — if an earlier ensureSiteUrl() left it at the
 * host-mapped baseURL, and confirms the running server reports that value.
 *
 * Call this from any spec whose assertions depend on the server reaching its own HTTP routes.
 * Interactive dialogs are the common case: a plugin registers a callback URL of
 * `<SiteURL>/plugins/<id>/...`, and the server POSTs to it over the network, because
 * App.DoActionRequest only dispatches in-process for URLs that are already relative. With a
 * host-mapped SiteURL those callbacks never arrive, so a dialog submit leaves the dialog open and
 * a cancel posts no notification.
 *
 * A no-op on a server booted with the default SiteURL, which is every stack no ensureSiteUrl()
 * caller has run against.
 */
export async function ensureInternalSiteUrl(): Promise<void> {
    // `external` mode has one address for both, and initSetup()'s patchConfig already sets
    // SiteURL to it, so there is nothing to converge and no container to restart.
    if (!testConfig.useTestContainers) {
        return;
    }

    await ensureSiteUrlValue(testConfig.internalBaseURL);
}

async function ensureSiteUrlValue(siteUrl: string): Promise<void> {
    if (!testConfig.useTestContainers) {
        test.skip(true, 'Skipping test - SiteURL restart requires PW_USE_TESTCONTAINERS=true');
        return;
    }

    try {
        const env = {MM_SERVICESETTINGS_SITEURL: siteUrl};
        if (!bootEnvMatches(env)) {
            await restartMattermostContainer(env);
        }

        const {adminClient} = await getAdminClient();
        const config = await adminClient.getConfig();
        if (config.ServiceSettings.SiteURL !== siteUrl) {
            throw new Error(
                `ServiceSettings.SiteURL is "${config.ServiceSettings.SiteURL}" after restart, expected ` +
                    `"${siteUrl}".`,
            );
        }
    } catch (error) {
        test.skip(true, `Skipping test - SiteURL check failed: ${String(error)}`);
    }
}
