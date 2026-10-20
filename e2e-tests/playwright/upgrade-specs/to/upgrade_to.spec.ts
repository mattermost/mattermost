// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getPluginStatus, saveUpgradePhaseLogs, test} from '@mattermost/playwright-lib';

import {
    assertChannelContainsMessage,
    assertSearchFinds,
    assertUpgradeFileBackendMatches,
    assertUpgradeLicenseMatches,
    assertUpgradePlaybooksMatches,
    assertUpgradeSchemaMatches,
    channelIdForAttachmentSeed,
    ensureUpgradeTeam,
    loadUpgradeToContext,
    readServerIdentity,
    seeder,
} from '../upgrade_fixtures';

/**
 * @objective Re-verifies upgrade actors and content via Client4 after swap to the to-image.
 * Each test checks a slice of `.upgrade_baseline.json` written by upgrade-from.
 */
test.describe.serial('upgrade-to baseline', {tag: ['@upgrade-to']}, () => {
    test.afterAll(async () => {
        // Snapshot to-image logs (includes post-swap migrations + verification traffic).
        await saveUpgradePhaseLogs('to');
    });

    test('server identity upgraded and license matches baseline', async ({pw}) => {
        const {adminClient, baseline} = await loadUpgradeToContext(pw);

        // # Read the running to-image identity
        const toIdentity = await readServerIdentity(adminClient);

        // * Verify server version/build changed from the from-image baseline
        expect(`${toIdentity.serverVersion}+${toIdentity.buildNumber}`).not.toBe(
            `${baseline.serverVersion}+${baseline.buildNumber}`,
        );

        // * Verify license state still matches the from-image baseline after swap
        await assertUpgradeLicenseMatches(adminClient, baseline);
    });

    test('schema migrations match baseline', async ({pw}) => {
        const {adminClient, baseline} = await loadUpgradeToContext(pw);
        test.skip(!baseline.schema, 'From-image did not expose GET /api/v4/system/schema/version');

        // * Verify migrations are present and did not regress vs the from-image baseline
        const schema = await assertUpgradeSchemaMatches(adminClient, baseline);
        // eslint-disable-next-line no-console
        console.log(
            `upgrade-to: schema versionMax=${schema?.versionMax} count=${schema?.count} (from ${baseline.schema?.versionMax}/${baseline.schema?.count})`,
        );
    });

    test('user channel messages match baseline', async ({pw}) => {
        const {userClient, adminClient, baseline, publicChannelId, privateChannelId} = await loadUpgradeToContext(pw);
        const team = await ensureUpgradeTeam(adminClient);

        // * Verify user public/private/DM/GM messages still exist
        await assertChannelContainsMessage(userClient, publicChannelId, seeder.UPGRADE_PUBLIC_MESSAGE);
        await assertChannelContainsMessage(userClient, privateChannelId, seeder.UPGRADE_PRIVATE_MESSAGE);
        await assertChannelContainsMessage(userClient, baseline.userDmChannelId, seeder.UPGRADE_DM_MESSAGE);
        await assertChannelContainsMessage(userClient, baseline.userGmChannelId, seeder.UPGRADE_GM_MESSAGE);

        // * Verify search still finds the user search marker
        await assertSearchFinds(userClient, team.id, seeder.UPGRADE_SEARCH_MESSAGE);
    });

    test('attachments and file backend match baseline', async ({pw, request}) => {
        const {adminClient, userClient, baseline, publicChannelId, privateChannelId} = await loadUpgradeToContext(pw);

        // * Verify each seeded attachment post message still exists
        for (const seed of seeder.UPGRADE_ATTACHMENT_SEEDS) {
            const channelId = channelIdForAttachmentSeed(seed.channel, {
                publicId: publicChannelId,
                privateId: privateChannelId,
                userDmId: baseline.userDmChannelId,
            });
            const client = seed.author === 'user' ? userClient : adminClient;
            await assertChannelContainsMessage(client, channelId, seed.message);
        }

        // * Verify attachments/profile image remain downloadable on the active file backend
        await assertUpgradeFileBackendMatches(request, adminClient, userClient, baseline);
    });

    test('profile image and avatar thread match baseline', async ({pw}) => {
        const {userClient, baseline, publicChannelId} = await loadUpgradeToContext(pw);

        // * Verify the avatar root post survived the upgrade
        const avatarPost = await userClient.getPost(baseline.avatarPostId);
        expect(avatarPost.id).toBe(baseline.avatarPostId);
        expect(avatarPost.message).toContain('upgrade-check avatar message');

        // * Verify the thread reply is still under that root post
        const threadPosts = await userClient.getPosts(publicChannelId, 0, 60);
        const threadReply = Object.values(threadPosts.posts).find(
            (post) => post.root_id === baseline.avatarPostId && post.message.includes('thread reply'),
        );
        expect(threadReply).toBeDefined();
    });

    test('admin channel messages match baseline', async ({pw}) => {
        const {adminClient, baseline, publicChannelId, privateChannelId} = await loadUpgradeToContext(pw);
        const team = await ensureUpgradeTeam(adminClient);

        // * Verify admin public/private/DM/GM messages still exist
        await assertChannelContainsMessage(adminClient, publicChannelId, seeder.UPGRADE_ADMIN_PUBLIC_MESSAGE);
        await assertChannelContainsMessage(adminClient, publicChannelId, seeder.UPGRADE_ADMIN_AVATAR_MESSAGE);
        await assertChannelContainsMessage(adminClient, privateChannelId, seeder.UPGRADE_ADMIN_PRIVATE_MESSAGE);
        await assertChannelContainsMessage(adminClient, baseline.adminDmChannelId, seeder.UPGRADE_ADMIN_DM_MESSAGE);
        await assertChannelContainsMessage(adminClient, baseline.adminGmChannelId, seeder.UPGRADE_ADMIN_GM_MESSAGE);

        // * Verify search still finds the admin search marker
        await assertSearchFinds(adminClient, team.id, seeder.UPGRADE_ADMIN_SEARCH_MESSAGE);
    });

    test('playbooks plugin matches baseline', async ({pw}) => {
        const {adminClient, baseline} = await loadUpgradeToContext(pw);
        test.skip(!baseline.playbooks, 'From-image did not record playbooks plugin state');

        // * Verify playbooks config/runtime state survived the swap (read-only — no re-enable)
        await assertUpgradePlaybooksMatches(adminClient, baseline);
    });

    test('mmctl talks to the upgraded server', async ({pw}) => {
        // * Verify mmctl still works against the upgraded server, including unlicensed team runs
        const mmctlResult = await pw.runMmctl(['version']);
        expect(mmctlResult.exitCode).toBe(0);
    });

    test('demo plugin matches baseline', async ({pw}) => {
        const {adminClient, baseline} = await loadUpgradeToContext(pw);

        test.skip(!baseline.license?.isLicensed, 'Demo plugin requires an enterprise license');

        // * Verify the demo plugin is still installed and active after upgrade (read-only)
        await expect
            .poll(() => getPluginStatus(adminClient, seeder.UPGRADE_PLUGIN_ID), {timeout: 30000})
            .toEqual({
                isInstalled: true,
                isActive: true,
            });
    });
});
