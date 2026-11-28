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

        await expectManageChannelAutoTranslationChecked(app, 'channel_admin');
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

        await expectManageChannelAutoTranslationChecked(app, 'system_admin');
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

            // * A member can manage the channel's properties, so the Configuration tab is offered, without the switch
            const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
            await expect(configurationTab.autotranslationSwitch).not.toBeVisible();

            // Restore autotranslation to disabled via patchConfig (race-safe)
            await disableAutotranslationConfig(adminClient);
        },
    );
});

async function gotoSystemSchemePage(app: App) {
    // The Edit Scheme link leads here; the route is opened directly once the permissions migration has finished.
    const path = `${app.adminConsolePage.pathFor()}/user_management/permissions/system_scheme`;
    await app.page.goto(path);
    await expect(app.page).toHavePath(path);
    await expect(app.admin.permissions.system.cancelLink).toBeVisible();
}

/**
 * Asserts that "Manage Channel Auto Translation" is checked (ON) for the role: its permission tree holds one row in
 * the public channels group and one in the private channels group. The rows carry the same test ids in every role's
 * tree, and the generated lists are rooted at the page, so each row is looked up inside the role's own tree.
 */
async function expectManageChannelAutoTranslationChecked(app: App, roleName: string) {
    const tree = app.admin.permissions.role(roleName).locator;
    for (const permission of ['manage_public_channel_auto_translation', 'manage_private_channel_auto_translation']) {
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the same row id exists in every role's tree and the generated row list is rooted at the page, so a row can only be scoped to one role this way
        await expect(tree.getByTestId(`admin.permissions.group.row:${permission}--checkbox`)).toBeChecked();
    }
}
