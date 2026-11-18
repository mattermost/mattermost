// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {systemConsolePath, Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a System Console text setting saves to the server config and shows its saved value after a
 * reload.
 */
test('saves the site name from Customization', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const original = (await adminClient.getConfig()).TeamSettings.SiteName;
    const siteName = `Site ${pw.random.id()}`;

    try {
        // # Log in as admin and open Site Configuration > Customization
        const {app, page} = await pw.testBrowser.login(adminUser);
        await page.goto(systemConsolePath('site_config/customization'));

        // # Change the site name and save
        const setting = app.admin.setting('TeamSettings.SiteName');
        await setting.valueTextbox.fill(siteName);
        const saved = await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

        // * The server stored it
        expect(saved.TeamSettings.SiteName).toBe(siteName);

        // * After a reload the field shows the saved value
        await page.reload();
        await expect(setting.valueTextbox).toHaveValue(siteName);
    } finally {
        await adminClient.patchConfig({TeamSettings: {SiteName: original}});
    }
});
