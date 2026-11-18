// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openSystemConsoleSection, expect, type App} from '@mattermost/playwright-lib';

async function expectConsole(app: App) {
    await expect(app.backstage.navbar).toBeVisible();
    await expect(app.backstage.navbar.backLink).toBeVisible();
    await expect(app.admin.sidebar).toBeVisible();
}

/** Opens System Console > Environment > Mobile Security, once its settings show. */
export async function openMobileSecurity(app: App) {
    await openSystemConsoleSection(app, 'environment/mobile_security');
    await expectConsole(app);
    await expect(app.admin.screen('MobileSecuritySettings')).toBeVisible();
    await expect(app.admin.header).toContainText('Mobile Security');
    await expect(app.admin.header).toBeVisible();
    await expect(app.admin.saveButton).toBeVisible();
}

/** Opens Mobile Security without a license for it: the upsell. */
export async function openMobileSecurityUpsell(app: App) {
    await openSystemConsoleSection(app, 'environment/mobile_security');
    await expectConsole(app);
    await expect(app.admin.featureDiscovery).toBeVisible();
    await expect(app.admin.featureDiscovery.titleText).toBeVisible();
}

/** Opens another page (Users), to come back to Mobile Security. */
export async function openUsers(app: App) {
    await openSystemConsoleSection(app, 'user_management/users');
    await expectConsole(app);
    await expect(app.admin.users).toBeVisible();
    await expect(app.admin.header).toContainText('Mattermost Users');
    await expect.poll(async () => (await app.admin.users.table.rowList.keys()).length).toBeGreaterThan(0);
}
