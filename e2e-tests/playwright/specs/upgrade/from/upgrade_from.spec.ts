// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {UserProfile} from '@mattermost/types/users';

import {assetPath, expect, test, testConfig} from '@mattermost/playwright-lib';

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
    UPGRADE_PROFILE_PHOTO_FILE,
    UPGRADE_PUBLIC_CHANNEL_NAME,
    UPGRADE_PUBLIC_MESSAGE,
    UPGRADE_SEARCH_MESSAGE,
    UPGRADE_USER,
    ensurePluginBundleDownloaded,
    ensureUpgradeChannel,
    ensureUpgradeTeam,
    ensureUpgradeUser,
    writeUpgradeBaseline,
} from '../upgrade_fixtures';

/**
 * @objective Creates the upgrade test's actors and content through the UI on the from-image.
 */
test('upgrade-from: create actors and content', {tag: ['@upgrade-from']}, async ({pw}) => {
    test.setTimeout(300000);

    const {adminClient} = await pw.getAdminClient();

    try {
        await adminClient.patchConfig({
            AccessControlSettings: {
                EnableAttributeBasedAccessControl: false,
            },
        } as any);
    } catch {
        // Older server images omit ABAC config.
    }

    await pw.ensureLocalFile();

    const team = await ensureUpgradeTeam(adminClient);
    const user = await ensureUpgradeUser(adminClient, team.id, UPGRADE_USER);
    const peers = await Promise.all(UPGRADE_PEER_USERS.map((peer) => ensureUpgradeUser(adminClient, team.id, peer)));
    const publicChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PUBLIC_CHANNEL_NAME, 'O');
    const privateChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PRIVATE_CHANNEL_NAME, 'P');
    await adminClient.addToChannel(user.id, publicChannel.id);
    await adminClient.addToChannel(user.id, privateChannel.id);

    const adminMe = await adminClient.getMe();
    await adminClient.addToChannel(adminMe.id, publicChannel.id);
    await adminClient.addToChannel(adminMe.id, privateChannel.id);

    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(UPGRADE_PUBLIC_MESSAGE);
    await channelsPage.postMessage(UPGRADE_SEARCH_MESSAGE);

    await channelsPage.goto(team.name, privateChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(UPGRADE_PRIVATE_MESSAGE);

    const dmModal = await channelsPage.openDirectChannelsModal();
    await dmModal.selectUser(peers[0]);
    await dmModal.goToChannel();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(UPGRADE_DM_MESSAGE);

    const gmModal = await channelsPage.openDirectChannelsModal();
    await gmModal.selectUser(peers[1]);
    await gmModal.selectUser(peers[2]);
    await gmModal.goToChannel();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(UPGRADE_GM_MESSAGE);

    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.postMessage('upgrade-check attachment message', [UPGRADE_ATTACHMENT_FILE]);
    const attachmentPost = await channelsPage.getLastPost();
    await expect(attachmentPost.getFileAttachmentThumbnail(UPGRADE_ATTACHMENT_FILE)).toBeVisible();
    const attachmentPostId = await attachmentPost.getId();

    const profileModal = await channelsPage.openProfileModal();
    await profileModal.uploadProfilePhoto(path.join(assetPath, UPGRADE_PROFILE_PHOTO_FILE));
    await profileModal.closeModal();

    // Separate authors so the post header shows the profile icon.
    await adminClient.createPost({
        channel_id: publicChannel.id,
        message: 'upgrade-check avatar separator',
    });
    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('upgrade-check avatar message');
    const avatarPost = await channelsPage.getLastPost();
    const avatarPostId = await avatarPost.getId();
    expect(await avatarPost.hasLoadedAvatar()).toBe(true);

    const profilePopover = await channelsPage.openProfilePopover(avatarPost);
    expect(await profilePopover.hasLoadedAvatar()).toBe(true);
    await profilePopover.close();

    // Thread reply so the footer lists participant avatars.
    await adminClient.createPost({
        channel_id: publicChannel.id,
        message: 'upgrade-check thread reply for avatar footer',
        root_id: avatarPostId,
    });
    await channelsPage.goto(team.name, publicChannel.name);
    await channelsPage.toBeVisible();
    const avatarRootPost = await channelsPage.centerView.getPostById(avatarPostId);
    await avatarRootPost.threadFooter.toBeVisible();
    expect(await avatarRootPost.threadFooter.hasLoadedAvatars()).toBe(true);

    const aboutModal = await channelsPage.globalHeader.openAbout();
    const serverVersion = await aboutModal.getServerVersion();
    const buildNumber = await aboutModal.getBuildNumber();
    await aboutModal.close();

    const admin = {username: testConfig.adminUsername, password: testConfig.adminPassword} as UserProfile;
    const {channelsPage: adminChannelsPage, systemConsolePage} = await pw.testBrowser.login(admin);

    await adminChannelsPage.goto(team.name, publicChannel.name);
    await adminChannelsPage.toBeVisible();
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_PUBLIC_MESSAGE);
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_SEARCH_MESSAGE);

    await adminChannelsPage.goto(team.name, privateChannel.name);
    await adminChannelsPage.toBeVisible();
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_PRIVATE_MESSAGE);

    const adminDmModal = await adminChannelsPage.openDirectChannelsModal();
    await adminDmModal.selectUser(peers[0]);
    await adminDmModal.goToChannel();
    await adminChannelsPage.toBeVisible();
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_DM_MESSAGE);

    const adminGmModal = await adminChannelsPage.openDirectChannelsModal();
    await adminGmModal.selectUser(peers[1]);
    await adminGmModal.selectUser(peers[2]);
    await adminGmModal.goToChannel();
    await adminChannelsPage.toBeVisible();
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_GM_MESSAGE);

    await adminChannelsPage.goto(team.name, publicChannel.name);
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_ATTACHMENT_MESSAGE, [UPGRADE_ATTACHMENT_FILE]);
    const adminAttachmentPost = await adminChannelsPage.getLastPost();
    await expect(adminAttachmentPost.getFileAttachmentThumbnail(UPGRADE_ATTACHMENT_FILE)).toBeVisible();
    const adminAttachmentPostId = await adminAttachmentPost.getId();

    const {client: upgradeUserClient} = await pw.makeClient(user);
    await upgradeUserClient.createPost({
        channel_id: publicChannel.id,
        message: 'upgrade-check admin avatar separator',
    });
    await adminChannelsPage.goto(team.name, publicChannel.name);
    await adminChannelsPage.toBeVisible();
    await adminChannelsPage.postMessage(UPGRADE_ADMIN_AVATAR_MESSAGE);
    const adminAvatarPost = await adminChannelsPage.getLastPost();
    expect(await adminAvatarPost.hasLoadedAvatar()).toBe(true);

    const adminAboutModal = await adminChannelsPage.globalHeader.openAbout();
    await adminAboutModal.toBeVisible();
    expect(await adminAboutModal.getServerVersion()).toBe(serverVersion);
    await adminAboutModal.close();

    await systemConsolePage.gotoEditionAndLicense();
    await systemConsolePage.editionAndLicense.toHaveLicensePanel();

    const pluginBundlePath = await ensurePluginBundleDownloaded();
    await systemConsolePage.gotoPluginManagement();
    await systemConsolePage.pluginManagement.toBeVisible();
    await systemConsolePage.pluginManagement.uploadPlugin(pluginBundlePath);
    await systemConsolePage.pluginManagement.enablePlugin(UPGRADE_PLUGIN_ID);
    await systemConsolePage.pluginManagement.toBeEnabled(UPGRADE_PLUGIN_ID);

    let minioAttachmentPostId: string | undefined;
    if (testConfig.testcontainersServices.includes('minio')) {
        await pw.ensureMinio();
        const {channelsPage: minioChannelsPage} = await pw.testBrowser.login(user);
        await minioChannelsPage.goto(team.name, publicChannel.name);
        await minioChannelsPage.toBeVisible();
        await minioChannelsPage.postMessage('upgrade-check minio attachment', [UPGRADE_MINIO_ATTACHMENT_FILE]);
        const minioPost = await minioChannelsPage.getLastPost();
        await expect(minioPost.getFileAttachmentThumbnail(UPGRADE_MINIO_ATTACHMENT_FILE)).toBeVisible();
        minioAttachmentPostId = await minioPost.getId();
    }

    let azuriteAttachmentPostId: string | undefined;
    if (testConfig.testcontainersServices.includes('azurite')) {
        await pw.ensureAzurite();
        const {channelsPage: azuriteChannelsPage} = await pw.testBrowser.login(user);
        await azuriteChannelsPage.goto(team.name, publicChannel.name);
        await azuriteChannelsPage.toBeVisible();
        await azuriteChannelsPage.postMessage('upgrade-check azurite attachment', [UPGRADE_AZURITE_ATTACHMENT_FILE]);
        const azuritePost = await azuriteChannelsPage.getLastPost();
        await expect(azuritePost.getFileAttachmentThumbnail(UPGRADE_AZURITE_ATTACHMENT_FILE)).toBeVisible();
        azuriteAttachmentPostId = await azuritePost.getId();
    }

    if (testConfig.testcontainersServices.includes('minio') || testConfig.testcontainersServices.includes('azurite')) {
        await pw.ensureLocalFile();
    }

    writeUpgradeBaseline({
        serverVersion,
        buildNumber,
        attachmentPostId,
        avatarPostId,
        adminAttachmentPostId,
        minioAttachmentPostId,
        azuriteAttachmentPostId,
    });
});
