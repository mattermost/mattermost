// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4, ClientError} from '@mattermost/client';

import {expect} from '@mattermost/playwright-lib';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';

/**
 * installPluginFromUrl can fail with "Unable to restart plugin on upgrade" when activation
 * races (server thinks plugin is still active). Retry once after disable + brief settle.
 */
async function installAndEnableDemoPlugin(
    adminClient: Client4,
    pw: {
        installAndEnablePlugin: (client: Client4, pluginUrl: string, pluginId: string) => Promise<void>;
        isPluginActive: (client: Client4, pluginId: string) => Promise<boolean>;
    },
) {
    try {
        await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);
    } catch (err) {
        const msg = err instanceof ClientError ? err.message : String(err);
        if (!msg.includes('Unable to restart plugin on upgrade')) {
            throw err;
        }
        try {
            await adminClient.disablePlugin(DEMO_PLUGIN_ID);
        } catch {
            // Already inactive or transitional — continue.
        }
        await new Promise((r) => setTimeout(r, 2000));
        await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);
    }
}

export async function setupDemoPlugin(
    adminClient: Client4,
    pw: {
        installAndEnablePlugin: (client: Client4, pluginUrl: string, pluginId: string) => Promise<void>;
        isPluginActive: (client: Client4, pluginId: string) => Promise<boolean>;
    },
) {
    // No PluginStates here — patchConfig replaces that map wholesale. Enablement goes through
    // installAndEnablePlugin's enablePlugin call, which the server applies to this id alone.
    // EnableUploads is likewise absent: SERVER_ENV_BASELINE owns it and the API 403s on change.
    await adminClient.patchConfig({
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {EnableGifPicker: true},
        PluginSettings: {
            Enable: true,
            AllowInsecureDownloadURL: true,
            Plugins: {
                'com.mattermost.demo-plugin': {
                    username: 'demouser',
                    channelname: 'demo',
                    lastname: 'User',
                },
            },
        },
    });

    if (!(await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID))) {
        await installAndEnableDemoPlugin(adminClient, pw);
    }

    // Activation is asynchronous server-side, so poll rather than assert immediately.
    await expect.poll(() => pw.isPluginActive(adminClient, DEMO_PLUGIN_ID), {timeout: 30_000}).toBe(true);
}
