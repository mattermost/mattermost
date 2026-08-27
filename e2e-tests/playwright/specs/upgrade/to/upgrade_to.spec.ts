// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {expect, test, testConfig} from '@mattermost/playwright-lib';

import {
    UPGRADE_ADMIN_AVATAR_MESSAGE,
    UPGRADE_ADMIN_DM_MESSAGE,
    UPGRADE_ADMIN_GM_MESSAGE,
    UPGRADE_ADMIN_PRIVATE_MESSAGE,
    UPGRADE_ADMIN_PUBLIC_MESSAGE,
    UPGRADE_ADMIN_SEARCH_MESSAGE,
    UPGRADE_ATTACHMENT_FILE,
    UPGRADE_AZURITE_ATTACHMENT_FILE,
    UPGRADE_DM_MESSAGE,
    UPGRADE_GM_MESSAGE,
    UPGRADE_MINIO_ATTACHMENT_FILE,
    UPGRADE_PEER_USERS,
    UPGRADE_PLUGIN_ID,
    UPGRADE_PRIVATE_CHANNEL_NAME,
    UPGRADE_PRIVATE_MESSAGE,
    UPGRADE_PUBLIC_CHANNEL_NAME,
    UPGRADE_PUBLIC_MESSAGE,
    UPGRADE_SEARCH_MESSAGE,
    UPGRADE_USER,
    ensureUpgradeChannel,
    ensureUpgradeTeam,
    ensureUpgradeUser,
    readUpgradeBaseline,
    verifyPostAttachmentDownloadable,
} from '../upgrade_fixtures';

/**
 * @objective Re-verifies the upgrade test's actors and content through the UI, after the server
 * has been swapped to the to-image.
 */
test('upgrade-to: verify actors and content survived', {tag: ['@upgrade-to']}, async ({pw}) => {
    test.setTimeout(300000);

    const {adminClient} = await pw.getAdminClient();
    const team = await ensureUpgradeTeam(adminClient);
    const user = await ensureUpgradeUser(adminClient, team.id, UPGRADE_USER);
    const peers = await Promise.all(UPGRADE_PEER_USERS.map((peer) => ensureUpgradeUser(adminClient, team.id, peer)));
    const publicChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PUBLIC_CHANNEL_NAME, 'O');
    const privateChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PRIVATE_CHANNEL_NAME, 'P');
    const baseline = readUpgradeBaseline();

    await pw.ensureLocalFile();

    const {channelsPage} = await pw.testBrowser.login(user);
    const {client: upgradeUserClient} = await pw.makeClient(user);

    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_PUBLIC_MESSAGE);

    await channelsPage.goto(team.name, privateChannel.name);
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_PRIVATE_MESSAGE);

    const dmModal = await channelsPage.openDirectChannelsModal();
    await dmModal.selectUser(peers[0]);
    await dmModal.goToChannel();
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_DM_MESSAGE);

    const gmModal = await channelsPage.openDirectChannelsModal();
    await gmModal.selectUser(peers[1]);
    await gmModal.selectUser(peers[2]);
    await gmModal.goToChannel();
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_GM_MESSAGE);

    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    const attachmentPost = await channelsPage.centerView.getPostById(baseline.attachmentPostId);
    await expect(attachmentPost.getFileAttachmentThumbnail(UPGRADE_ATTACHMENT_FILE)).toBeVisible();
    await verifyPostAttachmentDownloadable(upgradeUserClient, baseline.attachmentPostId, UPGRADE_ATTACHMENT_FILE);

    const avatarPost = await channelsPage.centerView.getPostById(baseline.avatarPostId);
    expect(await avatarPost.hasLoadedAvatar()).toBe(true);

    const profilePopover = await channelsPage.openProfilePopover(avatarPost);
    expect(await profilePopover.hasLoadedAvatar()).toBe(true);
    await profilePopover.close();

    await avatarPost.threadFooter.toBeVisible();
    expect(await avatarPost.threadFooter.hasLoadedAvatars()).toBe(true);

    await channelsPage.searchFor(UPGRADE_SEARCH_MESSAGE);
    await channelsPage.searchResultsPanel.toContainText(UPGRADE_SEARCH_MESSAGE);

    const aboutModal = await channelsPage.globalHeader.openAbout();
    const serverVersion = await aboutModal.getServerVersion();
    const buildNumber = await aboutModal.getBuildNumber();
    await aboutModal.close();
    expect(`${serverVersion}+${buildNumber}`).not.toBe(`${baseline.serverVersion}+${baseline.buildNumber}`);

    const admin = {username: testConfig.adminUsername, password: testConfig.adminPassword} as UserProfile;
    const {channelsPage: adminChannelsPage, systemConsolePage} = await pw.testBrowser.login(admin);

    await adminChannelsPage.goto(team.name, publicChannel.name);
    await adminChannelsPage.toBeVisible();
    await expect(adminChannelsPage.centerView.container).toContainText(UPGRADE_ADMIN_PUBLIC_MESSAGE);
    await expect(adminChannelsPage.centerView.container).toContainText(UPGRADE_ADMIN_AVATAR_MESSAGE);

    await adminChannelsPage.goto(team.name, privateChannel.name);
    await adminChannelsPage.toBeVisible();
    await expect(adminChannelsPage.centerView.container).toContainText(UPGRADE_ADMIN_PRIVATE_MESSAGE);

    const adminDmModal = await adminChannelsPage.openDirectChannelsModal();
    await adminDmModal.selectUser(peers[0]);
    await adminDmModal.goToChannel();
    await adminChannelsPage.toBeVisible();
    await expect(adminChannelsPage.centerView.container).toContainText(UPGRADE_ADMIN_DM_MESSAGE);

    const adminGmModal = await adminChannelsPage.openDirectChannelsModal();
    await adminGmModal.selectUser(peers[1]);
    await adminGmModal.selectUser(peers[2]);
    await adminGmModal.goToChannel();
    await adminChannelsPage.toBeVisible();
    await expect(adminChannelsPage.centerView.container).toContainText(UPGRADE_ADMIN_GM_MESSAGE);

    await adminChannelsPage.goto(team.name, publicChannel.name);
    await adminChannelsPage.toBeVisible();
    const adminAttachmentPost = await adminChannelsPage.centerView.getPostById(baseline.adminAttachmentPostId);
    await expect(adminAttachmentPost.getFileAttachmentThumbnail(UPGRADE_ATTACHMENT_FILE)).toBeVisible();
    const {client: adminClientForFiles} = await pw.makeClient(admin);
    await verifyPostAttachmentDownloadable(
        adminClientForFiles,
        baseline.adminAttachmentPostId,
        UPGRADE_ATTACHMENT_FILE,
    );

    await adminChannelsPage.searchFor(UPGRADE_ADMIN_SEARCH_MESSAGE);
    await adminChannelsPage.searchResultsPanel.toContainText(UPGRADE_ADMIN_SEARCH_MESSAGE);

    const adminAboutModal = await adminChannelsPage.globalHeader.openAbout();
    await adminAboutModal.toBeVisible();
    expect(await adminAboutModal.getServerVersion()).toBe(serverVersion);
    expect(`${serverVersion}+${buildNumber}`).not.toBe(`${baseline.serverVersion}+${baseline.buildNumber}`);
    await adminAboutModal.close();

    await systemConsolePage.gotoEditionAndLicense();
    await systemConsolePage.editionAndLicense.toHaveLicensePanel();

    await systemConsolePage.gotoPluginManagement();
    await systemConsolePage.pluginManagement.toBeVisible();
    await expect(systemConsolePage.pluginManagement.pluginRow(UPGRADE_PLUGIN_ID)).toBeVisible();
    const enablePluginButton = systemConsolePage.pluginManagement
        .pluginRow(UPGRADE_PLUGIN_ID)
        .getByText('Enable', {exact: true});
    if (await enablePluginButton.isVisible().catch(() => false)) {
        await systemConsolePage.pluginManagement.enablePlugin(UPGRADE_PLUGIN_ID);
    }
    await systemConsolePage.pluginManagement.toBeEnabled(UPGRADE_PLUGIN_ID);

    const mmctlResult = await pw.runMmctl(['version']);
    expect(mmctlResult.exitCode).toBe(0);

    if (baseline.minioAttachmentPostId) {
        await pw.ensureMinio();
        const {channelsPage: minioChannelsPage} = await pw.testBrowser.login(user);
        const {client: minioUserClient} = await pw.makeClient(user);
        await minioChannelsPage.goto(team.name, publicChannel.name);
        await minioChannelsPage.toBeVisible();
        const minioPost = await minioChannelsPage.centerView.getPostById(baseline.minioAttachmentPostId);
        await expect(minioPost.getFileAttachmentThumbnail(UPGRADE_MINIO_ATTACHMENT_FILE)).toBeVisible();
        await verifyPostAttachmentDownloadable(
            minioUserClient,
            baseline.minioAttachmentPostId,
            UPGRADE_MINIO_ATTACHMENT_FILE,
        );
    }

    if (baseline.azuriteAttachmentPostId) {
        await pw.ensureAzurite();
        const {channelsPage: azuriteChannelsPage} = await pw.testBrowser.login(user);
        const {client: azuriteUserClient} = await pw.makeClient(user);
        await azuriteChannelsPage.goto(team.name, publicChannel.name);
        await azuriteChannelsPage.toBeVisible();
        const azuritePost = await azuriteChannelsPage.centerView.getPostById(baseline.azuriteAttachmentPostId);
        await expect(azuritePost.getFileAttachmentThumbnail(UPGRADE_AZURITE_ATTACHMENT_FILE)).toBeVisible();
        await verifyPostAttachmentDownloadable(
            azuriteUserClient,
            baseline.azuriteAttachmentPostId,
            UPGRADE_AZURITE_ATTACHMENT_FILE,
        );
    }
});
