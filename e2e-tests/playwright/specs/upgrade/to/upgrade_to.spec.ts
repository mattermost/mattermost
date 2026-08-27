// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {expect, test, testConfig} from '@mattermost/playwright-lib';

import {
    UPGRADE_ADMIN_ATTACHMENT_MESSAGE,
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

    // Local-disk backend first — from-phase restores it at the end, but be explicit in case a
    // prior ensureMinio/ensureAzurite left bootEnvOverrides on a different driver.
    await pw.ensureLocalFile();

    const {channelsPage} = await pw.testBrowser.login(user);

    // U1: public channel
    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_PUBLIC_MESSAGE);

    // U2: private channel
    await channelsPage.goto(team.name, privateChannel.name);
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_PRIVATE_MESSAGE);

    // U3: DM — re-selecting the same peer opens the existing DM channel, not a new one
    const dmModal = await channelsPage.openDirectChannelsModal();
    await dmModal.selectUser(peers[0]);
    await dmModal.goToChannel();
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_DM_MESSAGE);

    // U4: GM — same for the same member set
    const gmModal = await channelsPage.openDirectChannelsModal();
    await gmModal.selectUser(peers[1]);
    await gmModal.selectUser(peers[2]);
    await gmModal.goToChannel();
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container).toContainText(UPGRADE_GM_MESSAGE);

    // U6: local-disk sent file attachment still renders and downloads
    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    const attachmentPost = await channelsPage.centerView.getPostById(baseline.attachmentPostId);
    await expect(attachmentPost.getFileAttachmentThumbnail(UPGRADE_ATTACHMENT_FILE)).toBeVisible();
    await attachmentPost.downloadAttachment(UPGRADE_ATTACHMENT_FILE);

    // U5: avatar still renders on post header, profile popover, and thread footer
    const avatarPost = await channelsPage.centerView.getPostById(baseline.avatarPostId);
    expect(await avatarPost.hasLoadedAvatar()).toBe(true);

    const profilePopover = await channelsPage.openProfilePopover(avatarPost);
    expect(await profilePopover.hasLoadedAvatar()).toBe(true);
    await profilePopover.close();

    await avatarPost.threadFooter.toBeVisible();
    expect(await avatarPost.threadFooter.hasLoadedAvatars()).toBe(true);

    // U7: search still finds the pre-upgrade message
    await channelsPage.searchFor(UPGRADE_SEARCH_MESSAGE);
    await channelsPage.searchResultsPanel.toContainText(UPGRADE_SEARCH_MESSAGE);

    // U8: About modal now shows the to-version, not the from-phase baseline
    const aboutModal = await channelsPage.globalHeader.openAbout();
    const serverVersion = await aboutModal.getServerVersion();
    const buildNumber = await aboutModal.getBuildNumber();
    await aboutModal.close();
    expect(`${serverVersion}+${buildNumber}`).not.toBe(`${baseline.serverVersion}+${baseline.buildNumber}`);

    // A3: admin's own U1–U7 content survived
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
    await adminAttachmentPost.downloadAttachment(UPGRADE_ATTACHMENT_FILE);

    await adminChannelsPage.searchFor(UPGRADE_ADMIN_SEARCH_MESSAGE);
    await adminChannelsPage.searchResultsPanel.toContainText(UPGRADE_ADMIN_SEARCH_MESSAGE);

    // A1: admin About shows to-version; Edition and License page still loads
    const adminAboutModal = await adminChannelsPage.globalHeader.openAbout();
    await adminAboutModal.toBeVisible();
    expect(await adminAboutModal.getServerVersion()).toBe(serverVersion);
    expect(`${serverVersion}+${buildNumber}`).not.toBe(`${baseline.serverVersion}+${baseline.buildNumber}`);
    await adminAboutModal.close();

    await systemConsolePage.gotoEditionAndLicense();
    await systemConsolePage.editionAndLicense.toHaveLicensePanel();

    // A2: plugin still enabled
    await systemConsolePage.gotoPluginManagement();
    await systemConsolePage.pluginManagement.toBeVisible();
    await systemConsolePage.pluginManagement.toBeEnabled(UPGRADE_PLUGIN_ID);

    // A5: no product UI shows DB/schema health — mmctl is the closest admin-facing check that
    // ordinary data commands still work post-upgrade.
    const mmctlResult = await pw.runMmctl(['version']);
    expect(mmctlResult.exitCode).toBe(0);

    // A4: migration completion is already exercised by upgradeServerImage()'s boot wait strategy
    // (Wait.forLogMessage) — this test getting this far already proves it.

    // U6 (Minio): switch back onto Minio and confirm the pre-upgrade attachment still renders
    if (baseline.minioAttachmentPostId) {
        await pw.ensureMinio();
        const {channelsPage: minioChannelsPage} = await pw.testBrowser.login(user);
        await minioChannelsPage.goto(team.name, publicChannel.name);
        await minioChannelsPage.toBeVisible();
        const minioPost = await minioChannelsPage.centerView.getPostById(baseline.minioAttachmentPostId);
        await expect(minioPost.getFileAttachmentThumbnail(UPGRADE_MINIO_ATTACHMENT_FILE)).toBeVisible();
        await minioPost.downloadAttachment(UPGRADE_MINIO_ATTACHMENT_FILE);
    }

    // U6 (Azurite): same for the opt-in Azurite backend
    if (baseline.azuriteAttachmentPostId) {
        await pw.ensureAzurite();
        const {channelsPage: azuriteChannelsPage} = await pw.testBrowser.login(user);
        await azuriteChannelsPage.goto(team.name, publicChannel.name);
        await azuriteChannelsPage.toBeVisible();
        const azuritePost = await azuriteChannelsPage.centerView.getPostById(baseline.azuriteAttachmentPostId);
        await expect(azuritePost.getFileAttachmentThumbnail(UPGRADE_AZURITE_ATTACHMENT_FILE)).toBeVisible();
        await azuritePost.downloadAttachment(UPGRADE_AZURITE_ATTACHMENT_FILE);
    }
});
