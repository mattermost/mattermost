// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, UnsupportedDesktopAppPage} from '@mattermost/playwright-lib';

const MINIMUM_VERSION = '6.0.0';
const OLD_DESKTOP_VERSION = '5.0.0';
const DESKTOP_APP_USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Mattermost/${OLD_DESKTOP_VERSION} Chrome/120.0.0.0 Electron/28.0.0`;

test('Desktop App update required screen shows when connecting with older version', async ({pw}) => {
    const {adminClient} = await pw.initSetup();

    await adminClient.patchConfig({
        ServiceSettings: {
            MinimumDesktopAppVersion: MINIMUM_VERSION,
        },
    });

    const config = await adminClient.getConfig();
    const appDownloadLink = config.NativeAppSettings.AppDownloadLink;

    const context = await pw.testBrowser.browser.newContext({
        userAgent: DESKTOP_APP_USER_AGENT,
    });

    try {
        const page = await context.newPage();
        const unsupportedDesktopAppPage = new UnsupportedDesktopAppPage(page);
        await unsupportedDesktopAppPage.goto();
        await unsupportedDesktopAppPage.toBeVisible();

        await expect(unsupportedDesktopAppPage.message).toContainText(OLD_DESKTOP_VERSION);
        await expect(unsupportedDesktopAppPage.message).toContainText(MINIMUM_VERSION);
        await expect(unsupportedDesktopAppPage.downloadLink).toHaveAttribute('href', appDownloadLink);
    } finally {
        await context.close();
    }
});
