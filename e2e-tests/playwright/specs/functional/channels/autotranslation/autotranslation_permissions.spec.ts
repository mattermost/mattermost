// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    enableAutotranslationConfig,
    hasAutotranslationLicense,
    expect,
    test,
    SystemConsolePage,
} from '@mattermost/playwright-lib';

const MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION = 'manage_public_channel_auto_translation';

test(
    'permission exists; Channel Administrators have Manage Channel Auto Translation ON',
    {
        tag: ['@autotranslation', '@permissions'],
    },
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        await gotoSystemSchemePage(systemConsolePage);

        const scheme = systemConsolePage.permissionsSystemScheme;
        await scheme.toBeVisible();

        await scheme.expectManageChannelAutoTranslationChecked(scheme.channelAdministratorsSection);
    },
);

test(
    'System Administrators have Manage Channel Auto Translation ON',
    {
        tag: ['@autotranslation', '@permissions'],
    },
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        await gotoSystemSchemePage(systemConsolePage);

        const scheme = systemConsolePage.permissionsSystemScheme;
        await scheme.toBeVisible();

        await scheme.expectManageChannelAutoTranslationChecked(scheme.systemAdministratorsSection);
    },
);

test.describe('autotranslation configuration tests', () => {
    test(
        'DM menu shows Edit Header without permission and Channel Settings with permission',
        {
            tag: ['@autotranslation', '@permissions'],
        },
        async ({pw}) => {
            const {adminClient, user, team} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                !hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - server does not have Entry or Advanced license',
            );

            await enableAutotranslationConfig(adminClient, {
                mockBaseUrl: process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010',
                targetLanguages: ['en', 'es'],
            });

            const otherUserData = await pw.random.user('dm-peer');
            const otherUser = await adminClient.createUser(otherUserData, '', '');
            await adminClient.addToTeam(team.id, otherUser.id);
            await adminClient.createDirectChannel([user.id, otherUser.id]);

            const channelUserRole = (await adminClient.getRolesByNames(['channel_user']))[0];
            const originalPermissions = channelUserRole.permissions as string[];

            try {
                const withoutPermission = originalPermissions.filter((p) => p !== MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION);
                await adminClient.patchRole(channelUserRole.id, {permissions: withoutPermission});

                const {channelsPage} = await pw.testBrowser.login(user);
                await channelsPage.goto(team.name, `@${otherUser.username}`);
                await channelsPage.toBeVisible();

                await channelsPage.centerView.header.openChannelMenu();
                await expect(channelsPage.page.getByRole('menuitem', {name: 'Edit Header'})).toBeVisible();
                await expect(channelsPage.page.getByRole('menuitem', {name: 'Channel Settings'})).toHaveCount(0);

                const withPermission = [...new Set([...withoutPermission, MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION])];
                await adminClient.patchRole(channelUserRole.id, {permissions: withPermission});

                await channelsPage.page.reload();
                await channelsPage.toBeVisible();
                await channelsPage.centerView.header.openChannelMenu();
                await expect(channelsPage.page.getByRole('menuitem', {name: 'Channel Settings'})).toBeVisible();
                await expect(channelsPage.page.getByRole('menuitem', {name: 'Edit Header'})).toHaveCount(0);
            } finally {
                await adminClient.patchRole(channelUserRole.id, {permissions: originalPermissions});
            }
        },
    );

    test(
        'DM header saves from Channel Settings when permission is present',
        {
            tag: ['@autotranslation', '@permissions'],
        },
        async ({pw}) => {
            const {adminClient, user, team} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                !hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - server does not have Entry or Advanced license',
            );

            await enableAutotranslationConfig(adminClient, {
                mockBaseUrl: process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010',
                targetLanguages: ['en', 'es'],
            });

            const otherUserData = await pw.random.user('dm-peer');
            const otherUser = await adminClient.createUser(otherUserData, '', '');
            await adminClient.addToTeam(team.id, otherUser.id);
            const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);

            const channelUserRole = (await adminClient.getRolesByNames(['channel_user']))[0];
            const originalPermissions = channelUserRole.permissions as string[];
            const withPermission = [...new Set([...originalPermissions, MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION])];

            try {
                await adminClient.patchRole(channelUserRole.id, {permissions: withPermission});

                const {channelsPage} = await pw.testBrowser.login(user);
                await channelsPage.goto(team.name, `@${otherUser.username}`);
                await channelsPage.toBeVisible();

                const channelSettingsModal = await channelsPage.openChannelSettings();
                await channelSettingsModal.toBeVisible();

                const newHeader = `DM header ${pw.random.id()}`;
                await channelsPage.page.getByTestId('channel_settings_header_textbox').fill(newHeader);
                await channelsPage.page.getByRole('button', {name: 'Save'}).click();
                await channelSettingsModal.close();

                const updatedChannel = await adminClient.getChannel(dmChannel.id);
                expect(updatedChannel.header).toBe(newHeader);
            } finally {
                await adminClient.patchRole(channelUserRole.id, {permissions: originalPermissions});
            }
        },
    );

    test(
        'user without permission cannot enable autotranslation at channel level',
        {
            tag: ['@autotranslation', '@permissions'],
        },
        async ({pw}) => {
            const {adminClient, user, team} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                !hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - server does not have Entry or Advanced license',
            );

            // Capture original config for restoration
            const originalConfig = await adminClient.getConfig();

            try {
                // Enable autotranslation
                await enableAutotranslationConfig(adminClient, {
                    mockBaseUrl: process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010',
                    targetLanguages: ['en', 'es'],
                });

                const channelName = `autotranslation-perm-${pw.random.id()}`;
                const created = await adminClient.createChannel({
                    team_id: team.id,
                    name: channelName,
                    display_name: 'Permission Test Channel',
                    type: 'O',
                });
                await adminClient.addToChannel(user.id, created.id);

                const {channelsPage} = await pw.testBrowser.login(user);
                await channelsPage.goto(team.name, channelName);
                await channelsPage.toBeVisible();

                const channelSettingsModal = await channelsPage.openChannelSettings();
                const configTabVisible = await channelSettingsModal.configurationTab.isVisible();
                if (configTabVisible) {
                    const configurationTab = await channelSettingsModal.openConfigurationTab();
                    await expect(
                        configurationTab.container.getByTestId('channelTranslationToggle-button'),
                    ).not.toBeVisible();
                }
            } finally {
                // Restore original config to prevent state leakage
                await adminClient.updateConfig(originalConfig as any);
            }
        },
    );
});

async function gotoSystemSchemePage(systemConsolePage: SystemConsolePage) {
    await systemConsolePage.sidebar.userManagement.permissions.click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions/);

    await systemConsolePage.page.getByRole('link', {name: 'Edit Scheme'}).click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions\/system_scheme/);
}
