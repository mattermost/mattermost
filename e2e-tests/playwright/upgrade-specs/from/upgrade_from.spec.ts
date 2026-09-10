// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {saveUpgradePhaseLogs, test} from '@mattermost/playwright-lib';

import {
    assertProfileImageFetchable,
    clearUpgradeBaseline,
    ensureDirectChannel,
    ensureGroupChannel,
    ensureUpgradePlaybooksEnabled,
    ensureUpgradePluginActive,
    loadUpgradeFromContext,
    mergeUpgradeBaseline,
    persistUpgradeLicenseFromEnv,
    postMessage,
    readFileDriverName,
    readServerIdentity,
    readUpgradeBaseline,
    readUpgradeLicenseBaseline,
    readUpgradeSchemaBaseline,
    seedUpgradeAttachments,
    seeder,
    uploadUpgradeProfileImage,
} from '../upgrade_fixtures';

/**
 * @objective Seeds upgrade actors and content via Client4 / PlaywrightClient4 on the from-image.
 * Each test writes a slice of `.upgrade_baseline.json` so the captured state maps clearly to
 * what upgrade-to re-verifies. Prefer API clients for all setup/verify.
 */
test.describe.serial('upgrade-from baseline', {tag: ['@upgrade-from']}, () => {
    test.afterAll(async () => {
        // Snapshot from-image logs before upgrade-swap-to replaces the Mattermost container.
        await saveUpgradePhaseLogs('from');
    });

    test('server identity, actors, and channel ids', async ({pw}) => {
        // # Start from a clean baseline for this upgrade-from run
        clearUpgradeBaseline();

        // # Ensure shared team/users/channels and persist license into Postgres
        const {adminClient, user, adminMe, publicChannel, privateChannel} = await loadUpgradeFromContext(pw);
        await persistUpgradeLicenseFromEnv(adminClient);

        // # Capture from-image identity, license, schema migrations, and channel ids for upgrade-to
        const fromIdentity = await readServerIdentity(adminClient);
        const license = await readUpgradeLicenseBaseline(adminClient);
        const schema = await readUpgradeSchemaBaseline(adminClient);
        mergeUpgradeBaseline({
            serverVersion: fromIdentity.serverVersion,
            buildNumber: fromIdentity.buildNumber,
            schema,
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

        // # Post user messages in public/private (including a search marker)
        await postMessage(userClient, publicChannel.id, seeder.UPGRADE_PUBLIC_MESSAGE);
        await postMessage(userClient, publicChannel.id, seeder.UPGRADE_SEARCH_MESSAGE);
        await postMessage(userClient, privateChannel.id, seeder.UPGRADE_PRIVATE_MESSAGE);

        // # Create user DM/GM and post messages there
        const userDmChannel = await ensureDirectChannel(userClient, user.id, peers[0].id);
        await postMessage(userClient, userDmChannel.id, seeder.UPGRADE_DM_MESSAGE);

        const userGmChannel = await ensureGroupChannel(userClient, [user.id, peers[1].id, peers[2].id]);
        await postMessage(userClient, userGmChannel.id, seeder.UPGRADE_GM_MESSAGE);

        // # Record DM/GM channel ids for upgrade-to
        mergeUpgradeBaseline({
            userDmChannelId: userDmChannel.id,
            userGmChannelId: userGmChannel.id,
        });
    });

    test('attachments across channel types', async ({pw, request}) => {
        const {adminClient, userClient, user, peers, publicChannel, privateChannel} = await loadUpgradeFromContext(pw);
        const userDmChannel = await ensureDirectChannel(userClient, user.id, peers[0].id);

        // # Seed file attachments across public/private/DM and verify each is downloadable
        const attachments = await seedUpgradeAttachments(request, userClient, adminClient, {
            publicId: publicChannel.id,
            privateId: privateChannel.id,
            userDmId: userDmChannel.id,
        });

        // # Record attachment post ids for upgrade-to
        mergeUpgradeBaseline({attachments});
    });

    test('profile image and avatar thread post id', async ({pw, request}) => {
        const {adminClient, userClient, user, publicChannel} = await loadUpgradeFromContext(pw);

        // # Upload user profile image and confirm it is fetchable
        await uploadUpgradeProfileImage(userClient, user.id, seeder.UPGRADE_PROFILE_PHOTO_FILE);
        // * Verify profile image bytes are served
        await assertProfileImageFetchable(request, userClient, user.id);

        // # Create an avatar thread (root + reply) whose post id upgrade-to will re-check
        await postMessage(adminClient, publicChannel.id, 'upgrade-check avatar separator');
        const avatarPost = await postMessage(userClient, publicChannel.id, 'upgrade-check avatar message');
        await postMessage(adminClient, publicChannel.id, 'upgrade-check thread reply for avatar footer', avatarPost.id);

        mergeUpgradeBaseline({avatarPostId: avatarPost.id});
    });

    test('admin channel messages and dm/gm channel ids', async ({pw}) => {
        const {adminClient, userClient, adminMe, peers, publicChannel, privateChannel} =
            await loadUpgradeFromContext(pw);

        // # Post admin messages in public/private (including a search marker)
        await postMessage(adminClient, publicChannel.id, seeder.UPGRADE_ADMIN_PUBLIC_MESSAGE);
        await postMessage(adminClient, publicChannel.id, seeder.UPGRADE_ADMIN_SEARCH_MESSAGE);
        await postMessage(adminClient, privateChannel.id, seeder.UPGRADE_ADMIN_PRIVATE_MESSAGE);

        // # Create admin DM/GM and post messages there
        const adminDmChannel = await ensureDirectChannel(adminClient, adminMe.id, peers[0].id);
        await postMessage(adminClient, adminDmChannel.id, seeder.UPGRADE_ADMIN_DM_MESSAGE);

        const adminGmChannel = await ensureGroupChannel(adminClient, [adminMe.id, peers[1].id, peers[2].id]);
        await postMessage(adminClient, adminGmChannel.id, seeder.UPGRADE_ADMIN_GM_MESSAGE);

        // # Post an admin avatar message for post-upgrade re-check
        await postMessage(userClient, publicChannel.id, 'upgrade-check admin avatar separator');
        await postMessage(adminClient, publicChannel.id, seeder.UPGRADE_ADMIN_AVATAR_MESSAGE);

        // # Record admin DM/GM channel ids for upgrade-to
        mergeUpgradeBaseline({
            adminDmChannelId: adminDmChannel.id,
            adminGmChannelId: adminGmChannel.id,
        });
    });

    test('playbooks plugin enabled', async ({pw}) => {
        // # Enable prepackaged playbooks on the from-image (API only — not boot env)
        const {adminClient} = await loadUpgradeFromContext(pw);
        const playbooks = await ensureUpgradePlaybooksEnabled(adminClient);

        // # Record playbooks config/runtime state for upgrade-to
        mergeUpgradeBaseline({playbooks});
    });

    test('demo plugin active', async ({pw, request}) => {
        const baseline = readUpgradeBaseline();
        test.skip(!baseline.license?.isLicensed, 'Demo plugin requires an enterprise license');

        // # Install and enable the demo plugin on the from-image
        const {adminClient} = await loadUpgradeFromContext(pw);
        await ensureUpgradePluginActive(request, adminClient);
    });
});
