// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    UPGRADE_PRIVATE_CHANNEL_NAME,
    UPGRADE_PRIVATE_MESSAGE,
    UPGRADE_PROFILE_PHOTO_FILE,
    UPGRADE_PUBLIC_CHANNEL_NAME,
    UPGRADE_PUBLIC_MESSAGE,
    UPGRADE_SEARCH_MESSAGE,
    UPGRADE_USER,
    assertLicensed,
    assertProfileImageFetchable,
    ensureDirectChannel,
    ensureGroupChannel,
    ensureUpgradeChannel,
    ensureUpgradePluginActive,
    ensureUpgradeTeam,
    ensureUpgradeUser,
    postMessage,
    postWithAttachment,
    readServerIdentity,
    uploadUpgradeProfileImage,
    verifyPostAttachmentDownloadable,
    writeUpgradeBaseline,
} from '../upgrade_fixtures';

/**
 * @objective Seeds upgrade actors and content via Client4 / PlaywrightClient4 on the from-image.
 * Prefer API clients for all setup/verify. Use Playwright `request` for authenticated binary
 * downloads; browser login only via Playwright API (`loginByAPI`) if a session is required.
 */
test('upgrade-from: create actors and content', {tag: ['@upgrade-from']}, async ({pw, request}) => {
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

    const {client: userClient} = await pw.makeClient(user);
    expect(userClient).toBeTruthy();

    await postMessage(userClient!, publicChannel.id, UPGRADE_PUBLIC_MESSAGE);
    await postMessage(userClient!, publicChannel.id, UPGRADE_SEARCH_MESSAGE);
    await postMessage(userClient!, privateChannel.id, UPGRADE_PRIVATE_MESSAGE);

    const userDmChannel = await ensureDirectChannel(userClient!, user.id, peers[0].id);
    await postMessage(userClient!, userDmChannel.id, UPGRADE_DM_MESSAGE);

    const userGmChannel = await ensureGroupChannel(userClient!, [user.id, peers[1].id, peers[2].id]);
    await postMessage(userClient!, userGmChannel.id, UPGRADE_GM_MESSAGE);

    const attachmentPost = await postWithAttachment(
        userClient!,
        publicChannel.id,
        'upgrade-check attachment message',
        UPGRADE_ATTACHMENT_FILE,
    );
    await verifyPostAttachmentDownloadable(request, userClient!, attachmentPost.id, UPGRADE_ATTACHMENT_FILE);

    await uploadUpgradeProfileImage(userClient!, user.id, UPGRADE_PROFILE_PHOTO_FILE);
    await assertProfileImageFetchable(request, userClient!, user.id);

    // Separate authors so avatar posts are distinct from system/user continuity.
    await postMessage(adminClient, publicChannel.id, 'upgrade-check avatar separator');
    const avatarPost = await postMessage(userClient!, publicChannel.id, 'upgrade-check avatar message');
    await postMessage(adminClient, publicChannel.id, 'upgrade-check thread reply for avatar footer', avatarPost.id);

    const fromIdentity = await readServerIdentity(adminClient);
    await assertLicensed(adminClient);

    await postMessage(adminClient, publicChannel.id, UPGRADE_ADMIN_PUBLIC_MESSAGE);
    await postMessage(adminClient, publicChannel.id, UPGRADE_ADMIN_SEARCH_MESSAGE);
    await postMessage(adminClient, privateChannel.id, UPGRADE_ADMIN_PRIVATE_MESSAGE);

    const adminDmChannel = await ensureDirectChannel(adminClient, adminMe.id, peers[0].id);
    await postMessage(adminClient, adminDmChannel.id, UPGRADE_ADMIN_DM_MESSAGE);

    const adminGmChannel = await ensureGroupChannel(adminClient, [adminMe.id, peers[1].id, peers[2].id]);
    await postMessage(adminClient, adminGmChannel.id, UPGRADE_ADMIN_GM_MESSAGE);

    const adminAttachmentPost = await postWithAttachment(
        adminClient,
        publicChannel.id,
        UPGRADE_ADMIN_ATTACHMENT_MESSAGE,
        UPGRADE_ATTACHMENT_FILE,
    );
    await verifyPostAttachmentDownloadable(request, adminClient, adminAttachmentPost.id, UPGRADE_ATTACHMENT_FILE);

    await postMessage(userClient!, publicChannel.id, 'upgrade-check admin avatar separator');
    await postMessage(adminClient, publicChannel.id, UPGRADE_ADMIN_AVATAR_MESSAGE);

    await ensureUpgradePluginActive(request, adminClient);

    let minioAttachmentPostId: string | undefined;
    if (testConfig.testcontainersServices.includes('minio')) {
        await pw.ensureMinio();
        const {client: minioUserClient} = await pw.makeClient(user, {useCache: false});
        expect(minioUserClient).toBeTruthy();
        const minioPost = await postWithAttachment(
            minioUserClient!,
            publicChannel.id,
            'upgrade-check minio attachment',
            UPGRADE_MINIO_ATTACHMENT_FILE,
        );
        await verifyPostAttachmentDownloadable(request, minioUserClient!, minioPost.id, UPGRADE_MINIO_ATTACHMENT_FILE);
        minioAttachmentPostId = minioPost.id;
    }

    let azuriteAttachmentPostId: string | undefined;
    if (testConfig.testcontainersServices.includes('azurite')) {
        await pw.ensureAzurite();
        const {client: azuriteUserClient} = await pw.makeClient(user, {useCache: false});
        expect(azuriteUserClient).toBeTruthy();
        const azuritePost = await postWithAttachment(
            azuriteUserClient!,
            publicChannel.id,
            'upgrade-check azurite attachment',
            UPGRADE_AZURITE_ATTACHMENT_FILE,
        );
        await verifyPostAttachmentDownloadable(
            request,
            azuriteUserClient!,
            azuritePost.id,
            UPGRADE_AZURITE_ATTACHMENT_FILE,
        );
        azuriteAttachmentPostId = azuritePost.id;
    }

    if (testConfig.testcontainersServices.includes('minio') || testConfig.testcontainersServices.includes('azurite')) {
        await pw.ensureLocalFile();
    }

    writeUpgradeBaseline({
        serverVersion: fromIdentity.serverVersion,
        buildNumber: fromIdentity.buildNumber,
        userId: user.id,
        adminUserId: adminMe.id,
        publicChannelId: publicChannel.id,
        privateChannelId: privateChannel.id,
        userDmChannelId: userDmChannel.id,
        userGmChannelId: userGmChannel.id,
        adminDmChannelId: adminDmChannel.id,
        adminGmChannelId: adminGmChannel.id,
        attachmentPostId: attachmentPost.id,
        avatarPostId: avatarPost.id,
        adminAttachmentPostId: adminAttachmentPost.id,
        minioAttachmentPostId,
        azuriteAttachmentPostId,
    });
});
