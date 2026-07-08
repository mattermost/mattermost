// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SystemConsolePage} from '@mattermost/playwright-lib';
import {
    enableAutotranslationConfig,
    disableAutotranslationConfig,
    hasAutotranslationLicense,
    expect,
    test,
} from '@mattermost/playwright-lib';

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
        'DM menu follows effective RestrictDMAndGM client config',
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

            const originalConfig = await adminClient.getConfig();

            try {
                await enableAutotranslationConfig(adminClient, {
                    mockBaseUrl: process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010',
                    targetLanguages: ['en', 'es'],
                });
                await expect.poll(async () => (await adminClient.getClientConfig()).EnableAutoTranslation).toBe('true');
                const restrictDMAndGM = (await adminClient.getClientConfig()).RestrictDMAndGMAutotranslation;
                const shouldShowEditHeader = restrictDMAndGM === 'true';

                const peerData = await pw.random.user('dm-peer');
                const peerUser = await adminClient.createUser(peerData, '', '');
                await adminClient.addToTeam(team.id, peerUser.id);
                await adminClient.createDirectChannel([user.id, peerUser.id]);

                const {channelsPage} = await pw.testBrowser.login(user);
                await channelsPage.goto(team.name, `@${peerUser.username}`);
                await channelsPage.toBeVisible();

                await channelsPage.centerView.header.openChannelMenu();
                if (shouldShowEditHeader) {
                    await expect(channelsPage.channelHeaderMenu.editHeader).toBeVisible();
                    await expect(channelsPage.channelHeaderMenu.channelSettings).toHaveCount(0);
                } else {
                    await expect(channelsPage.channelHeaderMenu.channelSettings).toBeVisible();
                    await expect(channelsPage.channelHeaderMenu.editHeader).toHaveCount(0);
                }
            } finally {
                await adminClient.updateConfig(originalConfig as any);
            }
        },
    );

    test(
        'DM menu shows Edit Header when RestrictDMAndGM is enabled',
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

            const originalConfig = await adminClient.getConfig();

            try {
                await enableAutotranslationConfig(adminClient, {
                    mockBaseUrl: process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010',
                    targetLanguages: ['en', 'es'],
                });
                const configAfterEnable = (await adminClient.getConfig()) as any;
                await adminClient.updateConfig({
                    ...configAfterEnable,
                    AutoTranslationSettings: {
                        ...configAfterEnable.AutoTranslationSettings,
                        RestrictDMAndGM: true,
                    },
                } as any);

                await expect
                    .poll(
                        async () => ((await adminClient.getConfig()) as any)?.AutoTranslationSettings?.RestrictDMAndGM,
                    )
                    .toBe(true);
                await expect.poll(async () => (await adminClient.getClientConfig()).EnableAutoTranslation).toBe('true');
                await expect
                    .poll(async () => (await adminClient.getClientConfig()).RestrictDMAndGMAutotranslation)
                    .toBe('true');

                const peerData = await pw.random.user('dm-peer-restricted');
                const peerUser = await adminClient.createUser(peerData, '', '');
                await adminClient.addToTeam(team.id, peerUser.id);
                await adminClient.createDirectChannel([user.id, peerUser.id]);

                const {channelsPage} = await pw.testBrowser.login(user);
                await channelsPage.goto(team.name, `@${peerUser.username}`);
                await channelsPage.toBeVisible();

                await channelsPage.centerView.header.openChannelMenu();
                await expect(channelsPage.channelHeaderMenu.editHeader).toBeVisible();
                await expect(channelsPage.channelHeaderMenu.channelSettings).toHaveCount(0);
            } finally {
                await adminClient.updateConfig(originalConfig as any);
            }
        },
    );

    test(
        'DM header saves from Channel Settings',
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

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, `@${otherUser.username}`);
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.toBeVisible();

            const newHeader = `DM header ${pw.random.id()}`;
            const infoSettings = await channelSettingsModal.openInfoTab();
            await infoSettings.headerTextbox.fill(newHeader);
            await channelSettingsModal.save();
            await channelSettingsModal.close();

            await expect.poll(async () => (await adminClient.getChannel(dmChannel.id)).header).toBe(newHeader);
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

            // Restore autotranslation to disabled via patchConfig (race-safe)
            await disableAutotranslationConfig(adminClient);
        },
    );
});

async function gotoSystemSchemePage(systemConsolePage: SystemConsolePage) {
    await systemConsolePage.sidebar.userManagement.permissions.click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions/);

    await systemConsolePage.page.getByRole('link', {name: 'Edit Scheme'}).click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/user_management\/permissions\/system_scheme/);
}
