// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {Client4} from '@mattermost/client';

import {mergeWithOnPremServerConfig} from '@mattermost/playwright-lib';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';

export {DEMO_PLUGIN_ID, DEMO_PLUGIN_URL};

/**
 * Run `send` (typically fill slash command + click Send) while waiting for
 * POST /api/v4/commands/execute so the server finishes the slash handler before assertions.
 */
export async function sendDemoSlashCommand(page: Page, send: () => Promise<void>) {
    const responsePromise = page.waitForResponse(
        (r) =>
            r.url().includes('/api/v4/commands/execute') &&
            r.request().method() === 'POST' &&
            r.status() >= 200 &&
            r.status() < 500,
        {timeout: 45_000},
    );
    await Promise.all([send(), responsePromise]);
}

/** Wait until server reports plugin active (handles concurrent initSetup clearing PluginStates). */
async function waitUntilPluginActive(
    adminClient: Client4,
    pw: {isPluginActive: (client: Client4, pluginId: string) => Promise<boolean>},
    deadlineMs: number,
): Promise<boolean> {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
        if (await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID)) {
            return true;
        }
        try {
            await adminClient.enablePlugin(DEMO_PLUGIN_ID);
        } catch {
            // Transient — retry until deadline.
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

export async function setupDemoPlugin(
    adminClient: Client4,
    pw: {
        installAndEnablePlugin: (client: Client4, pluginUrl: string, pluginId: string) => Promise<void>;
        isPluginActive: (client: Client4, pluginId: string) => Promise<boolean>;
    },
) {
    // Merge with on-prem defaults so we never wipe PluginSettings.Enable, PluginStates for other
    // plugins, or omit EnableUploads — shallow patchConfig alone does that and breaks installs.
    const merged = mergeWithOnPremServerConfig({
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {EnableGifPicker: true},
        PluginSettings: {
            Enable: true,
            EnableUploads: true,
            AllowInsecureDownloadURL: true,
            Plugins: {
                'com.mattermost.demo-plugin': {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                },
            },
            PluginStates: {
                [DEMO_PLUGIN_ID]: {Enable: true},
            },
        },
    } as unknown as Parameters<typeof mergeWithOnPremServerConfig>[0]);

    await adminClient.patchConfig({
        FileSettings: merged.FileSettings,
        ServiceSettings: merged.ServiceSettings,
        PluginSettings: merged.PluginSettings,
    });

    const alreadyActive = await pw.isPluginActive(adminClient, DEMO_PLUGIN_ID);
    if (!alreadyActive) {
        await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);
    }

    if (await waitUntilPluginActive(adminClient, pw, 90_000)) {
        return;
    }

    // Corrupt/partial install or stuck inactive — remove and reinstall once.
    try {
        await adminClient.removePlugin(DEMO_PLUGIN_ID);
    } catch {
        // Not installed — ignore.
    }
    await pw.installAndEnablePlugin(adminClient, DEMO_PLUGIN_URL, DEMO_PLUGIN_ID);

    if (await waitUntilPluginActive(adminClient, pw, 90_000)) {
        return;
    }

    throw new Error(`Demo plugin ${DEMO_PLUGIN_ID} did not become active`);
}
