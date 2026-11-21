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
 * @objective Verify Check for Security and Release Updates is on Site Configuration > Notices, not Environment > SMTP, and saves ServiceSettings.EnableSecurityFixAlert
 */
test(
    'shows Check for Security and Release Updates on the Notices page and saves it',
    {tag: ['@system_console', '@notices']},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

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
        await expect(setting.helpText!).toContainText('securityupdatecheck.mattermost.com');
        await expect(setting.helpText!).toContainText('latest Mattermost release');

        // # Turn the setting on and save
        await setting.selectTrue();
        await systemConsolePage.notices.save();

        // * Verify the server config was updated
        const config = await adminClient.getConfig();
        expect(config.ServiceSettings.EnableSecurityFixAlert).toBe(true);
    },
);

/**
 * @objective Verify a delegated admin with read-only access to Notices sees the setting but cannot change it
 */
test(
    'is read-only for a delegated admin with read access to Notices',
    {tag: ['@system_console', '@notices']},
    async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, user} = await pw.initSetup();
        await adminClient.updateUserRoles(user.id, 'system_user system_read_only_admin');

        // # Log in as a read-only admin and open Site Configuration > Notices
        const {systemConsolePage} = await pw.testBrowser.login(user);
        await systemConsolePage.gotoNotices();

        // * Verify the setting is shown but disabled
        const setting = systemConsolePage.notices.checkForSecurityAndReleaseUpdates;
        await setting.toBeFalse();
        await expect(setting.trueOption).toBeDisabled();
        await expect(setting.falseOption).toBeDisabled();
    },
);

/**
 * @objective Verify a delegated admin with write access to Notices can change the setting
 */
test(
    'is writable for a delegated admin with write access to Notices',
    {tag: ['@system_console', '@notices']},
    async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, user} = await pw.initSetup();
        await adminClient.updateUserRoles(user.id, 'system_user system_manager');

        // # Log in as a system manager and open Site Configuration > Notices
        const {systemConsolePage} = await pw.testBrowser.login(user);
        await systemConsolePage.gotoNotices();

        // # Turn the setting on and save
        const setting = systemConsolePage.notices.checkForSecurityAndReleaseUpdates;
        await expect(setting.trueOption).toBeEnabled();
        await setting.selectTrue();
        await systemConsolePage.notices.save();

        // * Verify the server config was updated
        const config = await adminClient.getConfig();
        expect(config.ServiceSettings.EnableSecurityFixAlert).toBe(true);
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
