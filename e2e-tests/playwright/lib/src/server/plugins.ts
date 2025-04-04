// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {PluginManifest} from '@mattermost/types/plugins';

import {testConfig} from '@/test_config';

export async function ensurePluginsLoaded(client: Client4) {
    const pluginStatus = await client.getPluginStatuses();
    const plugins = await client.getPlugins();

    testConfig.ensurePluginsInstalled.forEach(async (pluginId) => {
        const isInstalled = pluginStatus.some((plugin) => plugin.plugin_id === pluginId);
        if (!isInstalled) {
            // eslint-disable-next-line no-console
            console.log(`${pluginId} is not installed. Related visual test will fail.`);
            return;
        }

        const isActive = plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
        if (!isActive) {
            await client.enablePlugin(pluginId);

            // eslint-disable-next-line no-console
            console.log(`${pluginId} is installed and has been activated.`);
        } else {
            // eslint-disable-next-line no-console
            console.log(`${pluginId} is installed and active.`);
        }
    });
}
