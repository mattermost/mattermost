// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    enableAutotranslationConfig,
    disableAutotranslationConfig,
    hasAutotranslationLicense,
    expect,
    test,
    closeChannelSettings,
    openChannelSettingsConfigurationTab,
    Api,
    generated,
    settle,
    type App,
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

        // The Edit Scheme link stays disabled until the permissions migration finishes
        await pw.ensurePhase2MigrationCompleted();

        const {app} = await pw.testBrowser.login(adminUser);
        await gotoSystemSchemePage(app);

        await expectManageChannelAutoTranslationChecked(app, 'channelAdministratorsSection');
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

        // The Edit Scheme link stays disabled until the permissions migration finishes
        await pw.ensurePhase2MigrationCompleted();

        const {app} = await pw.testBrowser.login(adminUser);
        await gotoSystemSchemePage(app);

        await expectManageChannelAutoTranslationChecked(app, 'systemAdministratorsSection');
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

                const {app} = await pw.testBrowser.login(user);
                await app.channelsPage.goto({team, path: 'messages', channel: `@${peerUser.username}`});
                await expect(app.center.postCreate).toBeVisible();

                await app.channelHeader.openMenuButton.click();
                if (shouldShowEditHeader) {
                    await expect(app.channelHeader.menu.editHeaderMenuItem).toBeVisible();
                    await expect(app.channelHeader.menu.channelSettingsMenuItem).toHaveCount(0);
                } else {
                    await expect(app.channelHeader.menu.channelSettingsMenuItem).toBeVisible();
                    await expect(app.channelHeader.menu.editHeaderMenuItem).toHaveCount(0);
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

                const {app} = await pw.testBrowser.login(user);
                await app.channelsPage.goto({team, path: 'messages', channel: `@${peerUser.username}`});
                await expect(app.center.postCreate).toBeVisible();

                await app.channelHeader.openMenuButton.click();
                await expect(app.channelHeader.menu.editHeaderMenuItem).toBeVisible();
                await expect(app.channelHeader.menu.channelSettingsMenuItem).toHaveCount(0);
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

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, path: 'messages', channel: `@${otherUser.username}`});
            await expect(app.center.postCreate).toBeVisible();

            await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
            const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(
                app.channelSettingsModal,
            );
            await expect(channelSettingsModal).toBeVisible();

            const newHeader = `DM header ${pw.random.id()}`;
            await channelSettingsModal.info.header.container.fill(newHeader);
            await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
            await closeChannelSettings(channelSettingsModal);

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

            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: channelName});
            await expect(app.center.postCreate).toBeVisible();

            await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
            const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(
                app.channelSettingsModal,
            );
            // The tabs render with the modal, and the test branches on whether this role is offered the tab at all
            const configTabVisible = await channelSettingsModal.tabs.tab('configuration').locator.isVisible();
            if (configTabVisible) {
                const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
                await expect(configurationTab.autotranslationSwitch.locator).not.toBeVisible();
            }

            // Restore autotranslation to disabled via patchConfig (race-safe)
            await disableAutotranslationConfig(adminClient);
        },
    );
});

async function gotoSystemSchemePage(app: App) {
    // The Edit Scheme link leads here; the route is opened directly once the permissions migration has finished.
    await app.page.goto(`${generated.AdminConsolePage.path()}/user_management/permissions/system_scheme`);
    await expect(app.page).toHaveURL(/\/admin_console\/user_management\/permissions\/system_scheme/);
    // The page's heading is plain text without a test id of its own.
    await expect(app.page.getByText('System Scheme', {exact: true})).toBeVisible();
}

/**
 * Asserts that "Manage Channel Auto Translation" is checked (ON) in the given role section. The role sections carry
 * only an element id, so the section is found by it; the permission rows and their checked marker inside it carry the
 * generated test ids (`admin.permissions.group.row:<permission>` and `admin.permissions.group.row.checkbox.checked`).
 * There can be two rows (public and private channel).
 */
async function expectManageChannelAutoTranslationChecked(app: App, sectionId: string) {
    const section = app.page.locator(`#${sectionId}`);
    const rows = section
        .locator('[data-testid^="admin.permissions.group.row:"]')
        .filter({hasText: 'Manage Channel Auto Translation'});
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count, 'Manage Channel Auto Translation permission rows were not found in the section').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('[data-testid="admin.permissions.group.row.checkbox.checked"]')).toBeVisible();
    }
}
