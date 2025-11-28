// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {PluginManifest} from '@mattermost/types/plugins';

export async function installAndEnablePlugin(
    client: Client4,
    pluginUrl: string,
    pluginId: string,
    force = true,
): Promise<void> {
    // Install from URL
    await client.installPluginFromUrl(pluginUrl, force);

    // Wait for installation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Enable plugin
    await client.enablePlugin(pluginId);

    // Wait for activation
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

export async function verifyPluginActive(client: Client4, pluginId: string): Promise<boolean> {
    const plugins = await client.getPlugins();
    return plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
}
