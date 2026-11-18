// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Msg, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify the clock display setting switches to the 24-hour clock and is saved as the
 * user's preference.
 */
test('switches the clock display to 24-hour and saves it', {tag: '@settings'}, async ({pw}) => {
    const {team, user, userClient} = await pw.initSetup();

    // # Log in and open Settings > Display
    const {app} = await pw.testBrowser.login(user);
    await app.teamPage.goto({team});
    await expect(app.center.composer).toBeVisible();
    await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
    await app.userSettingsModal.tabs.tab('display').select();
    await expect(app.userSettingsModal.tabs.tab('display')).toBeSelected();

    // # Expand the clock section and choose the 24-hour clock
    const clock = app.settings.display.section('clock');
    await clock.editButton.click();
    await expect(clock.clock.option('false')).toBeChecked();
    await clock.clock.option('true').check();
    await expect(clock.clock.option('true')).toBeChecked();
    await settle(clock.saveButton, {wait: Api.UpdatePreferences}).click();

    // * The collapsed section shows the 24-hour clock
    await expect(clock).toContainMessage(Msg.user.settings.display.militaryClock);

    // * It's saved as the user's preference
    const prefs = (await userClient.getMyPreferences()) as unknown as Array<{
        category: string;
        name: string;
        value: string;
    }>;
    expect(prefs.find((p) => p.category === 'display_settings' && p.name === 'use_military_time')?.value).toBe('true');
});
