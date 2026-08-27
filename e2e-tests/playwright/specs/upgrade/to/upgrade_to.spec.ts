// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
    UPGRADE_PRIVATE_CHANNEL_NAME,
    UPGRADE_PRIVATE_MESSAGE,
    UPGRADE_PUBLIC_CHANNEL_NAME,
    UPGRADE_PUBLIC_MESSAGE,
    UPGRADE_SEARCH_MESSAGE,
    UPGRADE_USER,
    assertChannelContainsMessage,
    assertLicensed,
    assertProfileImageFetchable,
    assertSearchFinds,
    ensureUpgradeChannel,
    ensureUpgradePluginActive,
    ensureUpgradeTeam,
    ensureUpgradeUser,
    readServerIdentity,
    readUpgradeBaseline,
    verifyPostAttachmentDownloadable,
} from '../upgrade_fixtures';

/**
 * @objective Re-verifies upgrade actors and content via Client4 / PlaywrightClient4 after swap to the to-image.
 * Binary downloads use Playwright `request`; no browser/POM interaction.
 */
test('upgrade-to: verify actors and content survived', {tag: ['@upgrade-to']}, async ({pw, request}) => {
    test.setTimeout(300000);

    const {adminClient} = await pw.getAdminClient();
    const team = await ensureUpgradeTeam(adminClient);
    const user = await ensureUpgradeUser(adminClient, team.id, UPGRADE_USER);
    await Promise.all(UPGRADE_PEER_USERS.map((peer) => ensureUpgradeUser(adminClient, team.id, peer)));
    const publicChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PUBLIC_CHANNEL_NAME, 'O');
    const privateChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PRIVATE_CHANNEL_NAME, 'P');
    const baseline = readUpgradeBaseline();

    await pw.ensureLocalFile();

    const {client: userClient} = await pw.makeClient(user);
    expect(userClient).toBeTruthy();

    const publicChannelId = baseline.publicChannelId || publicChannel.id;
    const privateChannelId = baseline.privateChannelId || privateChannel.id;

    await assertChannelContainsMessage(userClient!, publicChannelId, UPGRADE_PUBLIC_MESSAGE);
    await assertChannelContainsMessage(userClient!, privateChannelId, UPGRADE_PRIVATE_MESSAGE);
    await assertChannelContainsMessage(userClient!, baseline.userDmChannelId, UPGRADE_DM_MESSAGE);
    await assertChannelContainsMessage(userClient!, baseline.userGmChannelId, UPGRADE_GM_MESSAGE);

    await verifyPostAttachmentDownloadable(request, userClient!, baseline.attachmentPostId, UPGRADE_ATTACHMENT_FILE);
    await assertProfileImageFetchable(request, userClient!, baseline.userId || user.id);

    const avatarPost = await userClient!.getPost(baseline.avatarPostId);
    expect(avatarPost.id).toBe(baseline.avatarPostId);
    expect(avatarPost.message).toContain('upgrade-check avatar message');

    const threadPosts = await userClient!.getPosts(publicChannelId, 0, 60);
    const threadReply = Object.values(threadPosts.posts).find(
        (post) => post.root_id === baseline.avatarPostId && post.message.includes('thread reply'),
    );
    expect(threadReply).toBeDefined();

    await assertSearchFinds(userClient!, team.id, UPGRADE_SEARCH_MESSAGE);

    const toIdentity = await readServerIdentity(adminClient);
    expect(`${toIdentity.serverVersion}+${toIdentity.buildNumber}`).not.toBe(
        `${baseline.serverVersion}+${baseline.buildNumber}`,
    );
    await assertLicensed(adminClient);

    await assertChannelContainsMessage(adminClient, publicChannelId, UPGRADE_ADMIN_PUBLIC_MESSAGE);
    await assertChannelContainsMessage(adminClient, publicChannelId, UPGRADE_ADMIN_AVATAR_MESSAGE);
    await assertChannelContainsMessage(adminClient, privateChannelId, UPGRADE_ADMIN_PRIVATE_MESSAGE);
    await assertChannelContainsMessage(adminClient, baseline.adminDmChannelId, UPGRADE_ADMIN_DM_MESSAGE);
    await assertChannelContainsMessage(adminClient, baseline.adminGmChannelId, UPGRADE_ADMIN_GM_MESSAGE);

    await verifyPostAttachmentDownloadable(
        request,
        adminClient,
        baseline.adminAttachmentPostId,
        UPGRADE_ATTACHMENT_FILE,
    );
    await assertSearchFinds(adminClient, team.id, UPGRADE_ADMIN_SEARCH_MESSAGE);

    // Plugin may be auto-disabled across upgrades; re-upload/enable via API as needed.
    await ensureUpgradePluginActive(request, adminClient);

    const mmctlResult = await pw.runMmctl(['version']);
    expect(mmctlResult.exitCode).toBe(0);

    if (baseline.minioAttachmentPostId) {
        await pw.ensureMinio();
        const {client: minioUserClient} = await pw.makeClient(user, {useCache: false});
        expect(minioUserClient).toBeTruthy();
        await verifyPostAttachmentDownloadable(
            request,
            minioUserClient!,
            baseline.minioAttachmentPostId,
            UPGRADE_MINIO_ATTACHMENT_FILE,
        );
    }

    if (baseline.azuriteAttachmentPostId) {
        await pw.ensureAzurite();
        const {client: azuriteUserClient} = await pw.makeClient(user, {useCache: false});
        expect(azuriteUserClient).toBeTruthy();
        await verifyPostAttachmentDownloadable(
            request,
            azuriteUserClient!,
            baseline.azuriteAttachmentPostId,
            UPGRADE_AZURITE_ATTACHMENT_FILE,
        );
    }
});
