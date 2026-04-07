// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@mattermost/playwright-lib';
import {Client4} from '@mattermost/client';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.10.3/mattermost-plugin-demo-v0.10.3.tar.gz';

export async function setupDemoPlugin(
    adminClient: Client4,
    pw: {installAndEnablePlugin: Function; isPluginActive: Function},
) {
    await adminClient.patchConfig({
        FileSettings: {EnablePublicLink: true},
    });

    await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);

    await expect
        .poll(async () => {
            return await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID);
        })
        .toBe(true);
}
