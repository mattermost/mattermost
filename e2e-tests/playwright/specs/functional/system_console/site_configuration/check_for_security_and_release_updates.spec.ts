// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {SystemConsolePage} from '@mattermost/playwright-lib';

const SETTING_NAME = /Check for Security and Release Updates|Enable Security Alerts/;

async function expectNotOnSmtpPage(systemConsolePage: SystemConsolePage) {
    await systemConsolePage.page.goto('/admin_console/environment/smtp');
    const container = systemConsolePage.page.locator('#adminConsoleWrapper');
    await expect(container.getByRole('group', {name: /Skip Server Certificate Verification/})).toBeVisible();
    await expect(container.getByRole('group', {name: SETTING_NAME})).toHaveCount(0);
}

/**
 * @objective Verify Check for Security and Release Updates is on Site Configuration > Notices, not Environment > SMTP
 *
 * The test server pins ServiceSettings.EnableSecurityFixAlert through an environment variable, so the console always
 * renders it disabled. Changing the value and its permission gating are covered by the config API and admin definition tests.
 */
test(
    'shows Check for Security and Release Updates on the Notices page instead of the SMTP page',
    {tag: ['@system_console', '@notices']},
    async ({pw}) => {
        const {adminUser} = await pw.initSetup();

        // # Log in as a system admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // * Verify the setting is no longer on the SMTP page
        await expectNotOnSmtpPage(systemConsolePage);

        // # Open Site Configuration > Notices
        await systemConsolePage.gotoNotices();
        const setting = systemConsolePage.notices.checkForSecurityAndReleaseUpdates;

        // * Verify the setting is shown with the test baseline (off) and its help text covers both checks
        await setting.toBeVisible();
        await setting.toBeFalse();
        await expect(setting.helpText!).toContainText('security bulletins');
        await expect(setting.helpText!).toContainText('latest Mattermost release');
    },
);

/**
 * @objective Verify write access to SMTP alone no longer grants the setting
 */
test(
    'is not available to a delegated admin with only SMTP access',
    {tag: ['@system_console', '@notices']},
    async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, user} = await pw.initSetup();

        // # Grant the user manager role read and write access to SMTP, but not to Notices
        const role = await adminClient.getRoleByName('system_user_manager');
        await adminClient.patchRole(role.id, {
            permissions: [...role.permissions, 'sysconsole_read_environment_smtp', 'sysconsole_write_environment_smtp'],
        });
        await adminClient.updateUserRoles(user.id, 'system_user system_user_manager');

        // # Log in as that user
        const {systemConsolePage} = await pw.testBrowser.login(user);

        // * Verify the setting isn't on the SMTP page and Notices isn't in the sidebar
        await expectNotOnSmtpPage(systemConsolePage);
        await expect(systemConsolePage.sidebar.environment.smtp.link).toBeVisible();
        await expect(systemConsolePage.sidebar.siteConfiguration.notices.link).toHaveCount(0);
    },
);
