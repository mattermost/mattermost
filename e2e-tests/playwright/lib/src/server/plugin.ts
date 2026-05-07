// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {PluginManifest} from '@mattermost/types/plugins';

export async function isPluginActive(client: Client4, pluginId: string): Promise<boolean> {
    const plugins = await client.getPlugins();
    return plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
}

export async function getPluginStatus(
    client: Client4,
    pluginId: string,
): Promise<{isInstalled: boolean; isActive: boolean}> {
    const plugins = await client.getPlugins();

    const isActive = plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
    const isInactive = plugins.inactive.some((plugin: PluginManifest) => plugin.id === pluginId);

    return {
        isInstalled: isActive || isInactive,
        isActive,
    };
}

/**
 * Installs and enables a plugin with smart status checking
 * - If already active: does nothing
 * - If already installed: just enables it
 * - Otherwise: installs from URL, then enables
 */
export async function installAndEnablePlugin(
    client: Client4,
    pluginUrl: string,
    pluginId: string,
    force = true,
): Promise<void> {
    // Check current status
    const status = await getPluginStatus(client, pluginId);

    // If already active, nothing to do
    if (status.isActive) {
        return;
    }

    // If already installed but not active, just enable it
    if (status.isInstalled) {
        await client.enablePlugin(pluginId);
        return;
    }

    // Not installed - install from URL then enable
    await client.installPluginFromUrl(pluginUrl, force);
    await client.enablePlugin(pluginId);
}
