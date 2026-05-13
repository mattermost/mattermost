// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';

import {expect} from '@mattermost/playwright-lib';

const DEMO_PLUGIN_ID = 'com.mattermost.demo-plugin';
const DEMO_PLUGIN_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';

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
