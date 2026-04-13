// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {expect} from '@mattermost/playwright-lib';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0-linux-amd64.tar.gz';

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
                    channelname: 'demo',
                    lastname: 'User',
                },
            },
        },
    });

    await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);

    await expect
        .poll(async () => {
            return await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID);
        })
        .toBe(true);
}
