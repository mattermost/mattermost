// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const MINIMUM_VERSION = '6.0.0';
const OLD_DESKTOP_VERSION = '5.0.0';
const DESKTOP_APP_USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Mattermost/${OLD_DESKTOP_VERSION} Chrome/120.0.0.0 Electron/28.0.0`;

// The Update Required page is rendered by the server (server/channels/web/unsupported_desktop_app.go), outside the
// webapp the surface scan reads, so it has no generated page object: its heading, text and link are found by role.
test('Desktop App update required screen shows when connecting with older version', async ({pw}) => {
    const {adminClient} = await pw.initSetup();

    await adminClient.patchConfig({
        ServiceSettings: {
            MinimumDesktopAppVersion: MINIMUM_VERSION,
        },
    });

    const config = await adminClient.getConfig();
    const appDownloadLink = config.NativeAppSettings.AppDownloadLink;

    const {page} = await pw.testBrowser.newPage({userAgent: DESKTOP_APP_USER_AGENT});

    await page.goto('/');

    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- server-rendered Update Required page outside the scanned webapp: its heading name is the subject
    await expect(page.getByRole('heading', {name: 'Update Required'})).toBeVisible();

    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- server-rendered page outside the scanned webapp: no testid, found by its class
    const message = page.locator('.message');
    await expect(message).toContainText(OLD_DESKTOP_VERSION);
    await expect(message).toContainText(MINIMUM_VERSION);

    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- server-rendered page outside the scanned webapp: the link's accessible name is the subject
    const downloadLink = page.getByRole('link', {name: 'Download Updated App'});
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute('href', appDownloadLink);
});
