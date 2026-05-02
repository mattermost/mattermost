// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';

export {DEMO_PLUGIN_ID, DEMO_PLUGIN_URL};

export async function setupDemoPlugin(
    adminClient: Client4,
    pw: {
        installAndEnablePlugin: (client: Client4, pluginUrl: string, pluginId: string) => Promise<void>;
        isPluginActive: (client: Client4, pluginId: string) => Promise<boolean>;
    },
) {
    await adminClient.patchConfig({
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {EnableGifPicker: true},
        PluginSettings: {
            Plugins: {
                'com.mattermost.demo-plugin': {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                },
            },
        },
    });

    const alreadyActive = await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID);
    if (!alreadyActive) {
        await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);
    }

    // Server must report the plugin active before slash commands run; re-issue enable in case
    // another test's initSetup cleared PluginStates between install and now.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        if (await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID)) {
            return;
        }
        try {
            await adminClient.enablePlugin(DEMO_PLUGIN_ID);
        } catch {
            // Transient — retry until deadline.
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Demo plugin ${DEMO_PLUGIN_ID} did not become active`);
}
