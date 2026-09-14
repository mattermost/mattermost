// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import {ClientError} from '@mattermost/client';

import {expect} from '@mattermost/playwright-lib';

const assetPath = path.resolve(__dirname, '../../../../asset');

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';

export {DEMO_PLUGIN_ID, DEMO_PLUGIN_URL};

// Repeated in all Root Modal tests — avoids duplicating the long trigger string
const ROOT_MODAL_TRIGGER_TEXT = 'You have triggered the root component of the demo plugin.';

/**
 * Asserts the Root Modal is visible with its 3 base lines.
 * Pass elementClicked to also assert the "Element clicked in the menu: X" line.
 * Note: "Element clicked in the menu: " and the item name render in separate <span> elements,
 * so they are asserted individually.
 */
export async function assertRootModal(page: Page, elementClicked?: string): Promise<void> {
    await expect(page.getByText(ROOT_MODAL_TRIGGER_TEXT, {exact: true})).toBeVisible();
    await expect(page.getByText('Click anywhere to close.', {exact: true})).toBeVisible();
    await expect(page.getByText('This is the English String', {exact: true})).toBeVisible();
    if (elementClicked) {
        await expect(page.getByText(/Element clicked in the menu:/)).toBeVisible();
        await expect(page.getByText(elementClicked, {exact: true})).toBeVisible();
    }
}

/**
 * Closes the Root Modal by clicking its trigger text and verifies it is gone.
 */
export async function closeRootModal(page: Page): Promise<void> {
    await page.getByText(ROOT_MODAL_TRIGGER_TEXT).click();
    await expect(page.getByText(ROOT_MODAL_TRIGGER_TEXT)).not.toBeVisible();
}

/**
 * Run `send` (typically fill slash command + click Send) while waiting for
 * POST /api/v4/commands/execute so the server finishes the slash handler before assertions.
 */
/**
 * Upload a file via the UI attachment menu when the demo plugin is active.
 * The demo plugin intercepts the attachment button and shows a submenu — this
 * helper clicks "Your computer" from that submenu to reach the native file chooser.
 */
export async function uploadFileViaYourComputer(
    page: Page,
    attachmentButton: {click: () => Promise<void>},
    filename: string,
): Promise<void> {
    const filePath = path.join(assetPath, filename);
    const uploadResponsePromise = page.waitForResponse(
        (r) =>
            r.url().includes('/api/v4/files') &&
            r.request().method() === 'POST' &&
            r.status() >= 200 &&
            r.status() < 300,
        {timeout: 60_000},
    );
    const fileChooserPromise = page.waitForEvent('filechooser');
    await attachmentButton.click();
    await page.getByText('Your computer').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    await uploadResponsePromise;
}

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
