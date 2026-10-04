// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';

import {demoPluginId, duration, expect, getPluginStatus, isPluginActive} from '@mattermost/playwright-lib';

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
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    await uploadResponsePromise;
}

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
 * Forces the demo plugin through one disable/enable cycle and waits for it to report active
 * again — the same recovery cycle plugin_crash.spec.ts uses after a deliberate crash.
 *
 * isPluginActive() can report true while interactive hooks (dialog submit/cancel, post
 * action callbacks) are still unresponsive: these hooks have been observed to stay broken
 * for the rest of a CI worker's run with no single confirmed trigger (reproduced in CI
 * without plugin_crash.spec.ts ever running first in the same worker), and simply retrying
 * the same click/submit action does not clear it. A full OnActivate cycle does. Use this as
 * a last-resort step inside a retry loop once plain retries have been exhausted, rather than
 * as the first response to a failure.
 */
export async function recoverDemoPlugin(adminClient: Client4): Promise<void> {
    await logDemoPluginDiagnostics(adminClient, 'recoverDemoPlugin:before');
    await adminClient.disablePlugin(demoPluginId);
    await adminClient.enablePlugin(demoPluginId);
    await expect.poll(() => isPluginActive(adminClient, demoPluginId), {timeout: duration.half_min}).toBe(true);
    await logDemoPluginDiagnostics(adminClient, 'recoverDemoPlugin:after');
}

// DEBUG-ONLY (temporary): visibility into server config/plugin state whenever a dialog
// submit/cancel attempt is made, to find what correlates with the hooks going unresponsive
// (see recoverDemoPlugin's doc comment above). Not a fix on its own — console.log so it shows
// up directly in CI job output without needing a custom server image or extra artifacts.
export async function logDemoPluginDiagnostics(adminClient: Client4, label: string): Promise<void> {
    try {
        const [config, status] = await Promise.all([
            adminClient.getConfig(),
            getPluginStatus(adminClient, demoPluginId),
        ]);
        // eslint-disable-next-line no-console
        console.log(
            `[demo-plugin-diag] ${label} ${JSON.stringify({
                siteUrl: config.ServiceSettings?.SiteURL,
                allowedUntrustedInternalConnections: config.ServiceSettings?.AllowedUntrustedInternalConnections,
                outgoingIntegrationRequestsTimeout: config.ServiceSettings?.OutgoingIntegrationRequestsTimeout,
                isActive: status.isActive,
                isInstalled: status.isInstalled,
            })}`,
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`[demo-plugin-diag] ${label} - failed to collect diagnostics: ${String(err)}`);
    }
}
