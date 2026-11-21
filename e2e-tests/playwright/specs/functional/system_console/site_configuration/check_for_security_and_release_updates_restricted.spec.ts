// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Check for Security and Release Updates is read-only when ExperimentalSettings.RestrictSystemAdmin is on
 */
test(
    'is read-only for a system admin when RestrictSystemAdmin is on',
    {tag: ['@system_console', '@notices']},
    async ({pw}) => {
        await pw.ensureServerEnv('MM_EXPERIMENTALSETTINGS_RESTRICTSYSTEMADMIN', 'true');
        const {adminUser} = await pw.initSetup();

        // # Log in as a system admin and open Site Configuration > Notices
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.gotoNotices();

        // * Verify the other notice settings stay editable while this setting is disabled
        await expect(systemConsolePage.notices.enableAdminNotices.falseOption).toBeEnabled();
        const setting = systemConsolePage.notices.checkForSecurityAndReleaseUpdates;
        await setting.toBeFalse();
        await expect(setting.trueOption).toBeDisabled();
        await expect(setting.falseOption).toBeDisabled();
    },
);
