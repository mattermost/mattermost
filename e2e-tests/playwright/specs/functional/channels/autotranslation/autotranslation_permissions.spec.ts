// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    enableAutotranslationConfig,
    hasAutotranslationLicense,
    expect,
    test,
    SystemConsolePage,
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
