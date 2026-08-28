// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {
    UPGRADE_ADMIN_AVATAR_MESSAGE,
    UPGRADE_ADMIN_DM_MESSAGE,
    UPGRADE_ADMIN_GM_MESSAGE,
    UPGRADE_ADMIN_PRIVATE_MESSAGE,
    UPGRADE_ADMIN_PUBLIC_MESSAGE,
    UPGRADE_ADMIN_SEARCH_MESSAGE,
    UPGRADE_DM_MESSAGE,
    UPGRADE_GM_MESSAGE,
    UPGRADE_PRIVATE_MESSAGE,
    UPGRADE_PROFILE_PHOTO_FILE,
    UPGRADE_PUBLIC_MESSAGE,
    UPGRADE_SEARCH_MESSAGE,
    assertProfileImageFetchable,
    clearUpgradeBaseline,
    ensureDirectChannel,
    ensureGroupChannel,
    ensureUpgradePluginActive,
    loadUpgradeFromContext,
    mergeUpgradeBaseline,
    persistUpgradeLicenseFromEnv,
    postMessage,
    readFileDriverName,
    readServerIdentity,
    readUpgradeBaseline,
    readUpgradeLicenseBaseline,
    seedUpgradeAttachments,
    uploadUpgradeProfileImage,
} from '../upgrade_fixtures';

/**
 * @objective Seeds upgrade actors and content via Client4 / PlaywrightClient4 on the from-image.
 * Each test writes a slice of `.upgrade_baseline.json` so the captured state maps clearly to
 * what upgrade-to re-verifies. Prefer API clients for all setup/verify.
 */
test.describe.serial('upgrade-from baseline', {tag: ['@upgrade-from']}, () => {
    test('server identity, actors, and channel ids', async ({pw}) => {
        clearUpgradeBaseline();

        const {adminClient, user, adminMe, publicChannel, privateChannel} = await loadUpgradeFromContext(pw);
        await persistUpgradeLicenseFromEnv(adminClient);
        const fromIdentity = await readServerIdentity(adminClient);
        const license = await readUpgradeLicenseBaseline(adminClient);

        mergeUpgradeBaseline({
            serverVersion: fromIdentity.serverVersion,
            buildNumber: fromIdentity.buildNumber,
            fileDriverName: await readFileDriverName(adminClient),
            license,
            userId: user.id,
            adminUserId: adminMe.id,
            publicChannelId: publicChannel.id,
            privateChannelId: privateChannel.id,
        });
    });

    test('user channel messages and dm/gm channel ids', async ({pw}) => {
        const {userClient, user, peers, publicChannel, privateChannel} = await loadUpgradeFromContext(pw);

        await postMessage(userClient, publicChannel.id, UPGRADE_PUBLIC_MESSAGE);
        await postMessage(userClient, publicChannel.id, UPGRADE_SEARCH_MESSAGE);
        await postMessage(userClient, privateChannel.id, UPGRADE_PRIVATE_MESSAGE);

        const userDmChannel = await ensureDirectChannel(userClient, user.id, peers[0].id);
        await postMessage(userClient, userDmChannel.id, UPGRADE_DM_MESSAGE);

        const userGmChannel = await ensureGroupChannel(userClient, [user.id, peers[1].id, peers[2].id]);
        await postMessage(userClient, userGmChannel.id, UPGRADE_GM_MESSAGE);

        mergeUpgradeBaseline({
            userDmChannelId: userDmChannel.id,
            userGmChannelId: userGmChannel.id,
        });
    });

    test('attachments across channel types', async ({pw, request}) => {
        const {adminClient, userClient, user, peers, publicChannel, privateChannel} = await loadUpgradeFromContext(pw);
        const userDmChannel = await ensureDirectChannel(userClient, user.id, peers[0].id);

        const attachments = await seedUpgradeAttachments(request, userClient, adminClient, {
            publicId: publicChannel.id,
            privateId: privateChannel.id,
            userDmId: userDmChannel.id,
        });

        mergeUpgradeBaseline({attachments});
    });

    test('profile image and avatar thread post id', async ({pw, request}) => {
        const {adminClient, userClient, user, publicChannel} = await loadUpgradeFromContext(pw);

        await uploadUpgradeProfileImage(userClient, user.id, UPGRADE_PROFILE_PHOTO_FILE);
        await assertProfileImageFetchable(request, userClient, user.id);

        await postMessage(adminClient, publicChannel.id, 'upgrade-check avatar separator');
        const avatarPost = await postMessage(userClient, publicChannel.id, 'upgrade-check avatar message');
        await postMessage(adminClient, publicChannel.id, 'upgrade-check thread reply for avatar footer', avatarPost.id);

        mergeUpgradeBaseline({avatarPostId: avatarPost.id});
    });

    test('admin channel messages and dm/gm channel ids', async ({pw}) => {
        const {adminClient, userClient, adminMe, peers, publicChannel, privateChannel} =
            await loadUpgradeFromContext(pw);

        await postMessage(adminClient, publicChannel.id, UPGRADE_ADMIN_PUBLIC_MESSAGE);
        await postMessage(adminClient, publicChannel.id, UPGRADE_ADMIN_SEARCH_MESSAGE);
        await postMessage(adminClient, privateChannel.id, UPGRADE_ADMIN_PRIVATE_MESSAGE);

        const adminDmChannel = await ensureDirectChannel(adminClient, adminMe.id, peers[0].id);
        await postMessage(adminClient, adminDmChannel.id, UPGRADE_ADMIN_DM_MESSAGE);

        const adminGmChannel = await ensureGroupChannel(adminClient, [adminMe.id, peers[1].id, peers[2].id]);
        await postMessage(adminClient, adminGmChannel.id, UPGRADE_ADMIN_GM_MESSAGE);

        await postMessage(userClient, publicChannel.id, 'upgrade-check admin avatar separator');
        await postMessage(adminClient, publicChannel.id, UPGRADE_ADMIN_AVATAR_MESSAGE);

        mergeUpgradeBaseline({
            adminDmChannelId: adminDmChannel.id,
            adminGmChannelId: adminGmChannel.id,
        });
    });

    test('demo plugin active', async ({pw, request}) => {
        const baseline = readUpgradeBaseline();
        test.skip(!baseline.license?.isLicensed, 'Demo plugin requires an enterprise license');

        const {adminClient} = await loadUpgradeFromContext(pw);
        await ensureUpgradePluginActive(request, adminClient);
    });
});
