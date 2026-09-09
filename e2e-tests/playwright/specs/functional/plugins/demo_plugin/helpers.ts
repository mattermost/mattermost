// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import {ClientError} from '@mattermost/client';

import {expect} from '@mattermost/playwright-lib';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';

export {DEMO_PLUGIN_ID, DEMO_PLUGIN_URL};

/**
 * Run `send` (typically fill slash command + click Send) while waiting for
 * POST /api/v4/commands/execute so the server finishes the slash handler before assertions.
 */
export async function sendDemoSlashCommand(page: Page, send: () => Promise<void>) {
    // Accept any response status (including 5xx) so the 45 s timeout does not fire when the
    // plugin is transiently inactive and the server returns HTTP 500.  The caller is responsible
    // for detecting a failed command (e.g. via a retry loop or explicit status check).
    const responsePromise = page.waitForResponse(
        (r) => r.url().includes('/api/v4/commands/execute') && r.request().method() === 'POST',
        {timeout: 45_000},
    );
    await Promise.all([send(), responsePromise]);
}

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
                    channelname: 'demo_plugin',
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
