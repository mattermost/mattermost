// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, openSystemConsoleSection, test, type App} from '@mattermost/playwright-lib';

const SECURITY_UPDATES = 'ServiceSettings.EnableSecurityFixAlert';

async function expectNotOnSmtpPage(app: App) {
    await openSystemConsoleSection(app, 'environment/smtp');
    await expect(app.admin.setting('EmailSettings.SkipServerCertificateVerification').container).toBeVisible();
    await expect(app.admin.setting(SECURITY_UPDATES).container).toHaveCount(0);
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
        const {app} = await pw.testBrowser.login(adminUser);

        // * Verify the setting is no longer on the SMTP page
        await expectNotOnSmtpPage(app);

        // # Open Site Configuration > Notices
        await openSystemConsoleSection(app, 'site_config/notices');
        await expect(app.admin.screen('NoticesSettings')).toBeVisible();
        const setting = app.admin.setting(SECURITY_UPDATES);

        // * Verify the setting is shown with the test baseline (off) and its help text covers both checks
        await expect(setting.container).toBeVisible();
        await expect(setting.falseRadio).toBeChecked();
        await expect(setting.setHelpText).toContainText('security bulletins');
        await expect(setting.setHelpText).toContainText('latest Mattermost release');
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
        const {app} = await pw.testBrowser.login(user);

        // * Verify the setting isn't on the SMTP page and Notices isn't in the sidebar
        await expectNotOnSmtpPage(app);
        await expect(app.admin.sidebar.category('environment').section('smtp').titleLink).toBeVisible();
        await expect(app.admin.sidebar.category('site').section('notices')).toHaveCount(0);
    },
);
