// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {Page} from '@playwright/test';

import {Api, expect, settle, type App} from '@mattermost/playwright-lib';

const assetPath = path.resolve(__dirname, '../../../../asset');

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
    await expect(page.getByText('Your computer')).not.toBeVisible();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    await uploadResponsePromise;
}

/**
 * Types a slash command into the center composer and sends it, waiting for POST /api/v4/commands/execute
 * so the server finishes the slash handler before assertions.
 */
export async function sendDemoSlashCommand(app: App, command: string) {
    const input = app.center.postCreate.message.container;
    await input.fill(command);
    await expect(input).toHaveValue(command);
    await settle(app.center.postCreate.sendButton, {wait: Api.ExecuteCommand}).click();
}

/**
 * The last center post whose text contains `text`. The demo plugin's ephemeral and interactive posts change their
 * content in place, so they are found again by what they say, not by a key: a scoped locator with that reason.
 */
export function centerPostWithText(app: App, text: string) {
    return app.center.postList.container.locator.getByRole('listitem').filter({hasText: text}).last();
}
