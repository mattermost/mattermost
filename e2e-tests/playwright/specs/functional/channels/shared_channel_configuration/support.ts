// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared helpers for shared-channel configuration spec files.
 *
 * All tests in this folder target Channel Settings → Configuration →
 * "Share with connected workspaces" and share the same license-gate
 * preamble.
 */

import {hasSharedChannelsLicense, test} from '@mattermost/playwright-lib';

/**
 * Skips the current test if the server does not have the Shared Channels
 * license. All shared_channel_configuration_* specs require this license.
 */
export async function skipUnlessSharedChannelsLicense(adminClient: {
    getClientLicenseOld: () => Promise<Record<string, string>>;
}): Promise<void> {
    const license = await adminClient.getClientLicenseOld();
    test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');
}

/**
 * Standard Connected Workspaces config used by most shared-channel
 * configuration tests: shared channels + Remote Cluster Service enabled.
 */
export const sharedChannelsEnabledConfig = {
    ConnectedWorkspacesSettings: {
        EnableSharedChannels: true,
        EnableRemoteClusterService: true,
    },
} as const;
