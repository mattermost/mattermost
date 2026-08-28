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
    UPGRADE_ATTACHMENT_SEEDS,
    UPGRADE_DM_MESSAGE,
    UPGRADE_GM_MESSAGE,
    UPGRADE_PRIVATE_MESSAGE,
    UPGRADE_PUBLIC_MESSAGE,
    UPGRADE_SEARCH_MESSAGE,
    assertChannelContainsMessage,
    assertSearchFinds,
    assertUpgradeFileBackendMatches,
    assertUpgradeLicenseMatches,
    channelIdForAttachmentSeed,
    ensureUpgradePluginActive,
    ensureUpgradeTeam,
    loadUpgradeToContext,
    readServerIdentity,
} from '../upgrade_fixtures';

/**
 * @objective Re-verifies upgrade actors and content via Client4 after swap to the to-image.
 * Each test checks a slice of `.upgrade_baseline.json` written by upgrade-from.
 */
test.describe.serial('upgrade-to baseline', {tag: ['@upgrade-to']}, () => {
    test('server identity upgraded and license matches baseline', async ({pw}) => {
        const {adminClient, baseline} = await loadUpgradeToContext(pw);
        const toIdentity = await readServerIdentity(adminClient);

        expect(`${toIdentity.serverVersion}+${toIdentity.buildNumber}`).not.toBe(
            `${baseline.serverVersion}+${baseline.buildNumber}`,
        );
        await assertUpgradeLicenseMatches(adminClient, baseline);
    });

    test('user channel messages match baseline', async ({pw}) => {
        const {userClient, adminClient, baseline, publicChannelId, privateChannelId} = await loadUpgradeToContext(pw);
        const team = await ensureUpgradeTeam(adminClient);

        await assertChannelContainsMessage(userClient, publicChannelId, UPGRADE_PUBLIC_MESSAGE);
        await assertChannelContainsMessage(userClient, privateChannelId, UPGRADE_PRIVATE_MESSAGE);
        await assertChannelContainsMessage(userClient, baseline.userDmChannelId, UPGRADE_DM_MESSAGE);
        await assertChannelContainsMessage(userClient, baseline.userGmChannelId, UPGRADE_GM_MESSAGE);
        await assertSearchFinds(userClient, team.id, UPGRADE_SEARCH_MESSAGE);
    });

    test('attachments and file backend match baseline', async ({pw, request}) => {
        const {adminClient, userClient, baseline, publicChannelId, privateChannelId} = await loadUpgradeToContext(pw);

        for (const seed of UPGRADE_ATTACHMENT_SEEDS) {
            const channelId = channelIdForAttachmentSeed(seed.channel, {
                publicId: publicChannelId,
                privateId: privateChannelId,
                userDmId: baseline.userDmChannelId,
            });
            const client = seed.author === 'user' ? userClient : adminClient;
            await assertChannelContainsMessage(client, channelId, seed.message);
        }

        await assertUpgradeFileBackendMatches(request, adminClient, userClient, baseline);
    });

    test('profile image and avatar thread match baseline', async ({pw}) => {
        const {userClient, baseline, publicChannelId} = await loadUpgradeToContext(pw);

        const avatarPost = await userClient.getPost(baseline.avatarPostId);
        expect(avatarPost.id).toBe(baseline.avatarPostId);
        expect(avatarPost.message).toContain('upgrade-check avatar message');

        const threadPosts = await userClient.getPosts(publicChannelId, 0, 60);
        const threadReply = Object.values(threadPosts.posts).find(
            (post) => post.root_id === baseline.avatarPostId && post.message.includes('thread reply'),
        );
        expect(threadReply).toBeDefined();
    });

    test('admin channel messages match baseline', async ({pw}) => {
        const {adminClient, baseline, publicChannelId, privateChannelId} = await loadUpgradeToContext(pw);
        const team = await ensureUpgradeTeam(adminClient);

        await assertChannelContainsMessage(adminClient, publicChannelId, UPGRADE_ADMIN_PUBLIC_MESSAGE);
        await assertChannelContainsMessage(adminClient, publicChannelId, UPGRADE_ADMIN_AVATAR_MESSAGE);
        await assertChannelContainsMessage(adminClient, privateChannelId, UPGRADE_ADMIN_PRIVATE_MESSAGE);
        await assertChannelContainsMessage(adminClient, baseline.adminDmChannelId, UPGRADE_ADMIN_DM_MESSAGE);
        await assertChannelContainsMessage(adminClient, baseline.adminGmChannelId, UPGRADE_ADMIN_GM_MESSAGE);
        await assertSearchFinds(adminClient, team.id, UPGRADE_ADMIN_SEARCH_MESSAGE);
    });

    test('demo plugin matches baseline', async ({pw, request}) => {
        const {adminClient, baseline} = await loadUpgradeToContext(pw);

        test.skip(!baseline.license?.isLicensed, 'Demo plugin requires an enterprise license');

        await ensureUpgradePluginActive(request, adminClient);

        const mmctlResult = await pw.runMmctl(['version']);
        expect(mmctlResult.exitCode).toBe(0);
    });
});
