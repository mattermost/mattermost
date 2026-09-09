// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PluginManifest} from '@mattermost/types/plugins';

import {aiPluginId, callsPluginId, npsPluginId, playbooksPluginId} from '@/constant';

/** The prepackaged plugins model.Config.SetDefaults() enables, so active on a fresh install. */
export const defaultEnabledPluginIds = [aiPluginId, callsPluginId, npsPluginId, playbooksPluginId];

/** Deactivates every active plugin outside the default set plus `keep`, returning what it disabled. */
export async function disableUnexpectedPlugins(client: Client4, keep: string[] = []): Promise<string[]> {
    const expected = new Set([...defaultEnabledPluginIds, ...keep]);
    const {active} = await client.getPlugins();
    const unexpected = active.filter((plugin: PluginManifest) => !expected.has(plugin.id)).map((plugin) => plugin.id);

    for (const pluginId of unexpected) {
        await client.disablePlugin(pluginId);
    }

    return unexpected;
}

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
