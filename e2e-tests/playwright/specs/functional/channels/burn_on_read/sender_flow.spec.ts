// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    openChannel,
    test,
    type PlaywrightClient4,
    type PlaywrightExtended,
    duration,
    DefaultChannel,
} from '@mattermost/playwright-lib';

import {BOR_TAG, createSecondUser, lastPost, recipientCount, reveal, sendBorMessage, setupBorTest} from './support';

/** A private channel with exactly the given users (the admin who creates it leaves). */
async function privateChannelWith(
    pw: PlaywrightExtended,
    adminClient: PlaywrightClient4,
    team: Team,
    users: UserProfile[],
    prefix: string,
) {
    const channelSuffix = Date.now().toString(36);
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: `${prefix}-${channelSuffix}`,
            displayName: `BoR Test ${channelSuffix}`,
            type: 'P',
        }),
    );
    for (const u of users) {
        await adminClient.addToChannel(u.id, channel.id);
    }

    // Remove admin from channel (they were auto-added as creator)
    const adminUser = await adminClient.getMe();
    await adminClient.removeFromChannel(adminUser.id, channel.id);
    return channel;
}

test.describe('Burn-on-Read Sender Flow', () => {
    test('MM-66742_15 sends BoR message and views sent status with recipient count', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user, team, adminClient} = await setupBorTest(pw);

        // # Create second user as recipient (needed for BoR badge count)
        await createSecondUser(pw, adminClient, team);

        // # Login as sender, turn burn-on-read on (its label shows) and send a message
        const app = await openChannel(pw, user, {team, channel: DefaultChannel.TownSquare});
        const message = `BoR Test ${pw.random.id()}`;
        const {post} = await sendBorMessage(app, message);

        // * Verify post has BoR badge
        await expect(post.burnOnReadButton).toBeVisible();

        // * Verify the flame icon is displayed
        await expect(post.burnOnReadFlame).toBeVisible();

        // # Hover over the badge to see its tooltip
        await post.burnOnReadButton.hover();
        await expect(post.burnOnReadButton.locator).toHaveAttribute('aria-label', /Read by/);

        // * Verify the badge describes the read count and how to delete (its label carries the tooltip's text)
        const label = (await post.burnOnReadButton.locator.getAttribute('aria-label')) ?? '';
        expect(label).toContain('Read by 0 of');
        expect(label).toContain('Click to delete');
    });

    test('MM-66742_16 sender sees read receipts in tooltip', {tag: [BOR_TAG]}, async ({pw}, testInfo) => {
        testInfo.setTimeout(duration.two_min);
        // # Initialize setup with BoR enabled
        const {user, team, adminClient} = await setupBorTest(pw);

        // # Create two recipients and a private channel with exactly these 3 users (sender + 2 recipients)
        const recipient1 = await createSecondUser(pw, adminClient, team);
        const recipient2 = await createSecondUser(pw, adminClient, team);
        const channel = await privateChannelWith(pw, adminClient, team, [user, recipient1, recipient2], 'bor-test');

        // # Login as sender and post BoR message
        const senderApp = await openChannel(pw, user, {team, channel});
        const {id: postId, post: senderPost} = await sendBorMessage(senderApp, `Secret message ${pw.random.id()}`);

        // * Verify initial state shows 0 of 2 recipients revealed (3 members - 1 sender)
        expect(await recipientCount(senderPost)).toEqual({revealed: 0, total: 2});

        // # Login as first recipient and reveal the message
        const recipient1App = await openChannel(pw, recipient1, {team, channel});
        await reveal(recipient1App.center.postList.post({id: postId}));

        // # Refresh sender's view and check updated count
        await senderApp.page.reload();
        await expect(senderPost.burnOnReadButton).toBeVisible({timeout: duration.half_min});
        expect((await recipientCount(senderPost)).revealed).toBe(1);

        // # Login as second recipient and reveal the message
        const recipient2App = await openChannel(pw, recipient2, {team, channel});
        await reveal(recipient2App.center.postList.post({id: postId}));

        // # Refresh sender's view — all recipients revealed, sender timer should start
        await senderApp.page.reload();

        // * After all recipients reveal, badge transitions to timer chip
        await expect(senderPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});
    });

    test('MM-66742_17 sender manually deletes for all recipients', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user, team, adminClient} = await setupBorTest(pw);

        // # Create recipient
        const recipient = await createSecondUser(pw, adminClient, team);

        // # Login as sender and post BoR message
        const senderApp = await openChannel(pw, user, {team, channel: DefaultChannel.TownSquare});
        const message = `To be deleted ${pw.random.id()}`;
        const {id: postId, post: senderPost} = await sendBorMessage(senderApp, message);

        // # Click flame badge to delete, and confirm
        await senderPost.burnOnReadButton.click();
        await expect(senderApp.burnOnReadConfirmationModal.confirmButton).toBeVisible();
        await senderApp.burnOnReadConfirmationModal.confirmButton.click();

        // * Verify the specific post is removed from sender's view
        await expect(senderPost).not.toBeVisible();

        // # Login as recipient
        const recipientApp = await openChannel(pw, recipient, {team, channel: DefaultChannel.TownSquare});

        // * Verify the deleted message is not in the channel (the channel's posts have loaded)
        await lastPost(recipientApp);
        await expect(recipientApp.center.postList.post({id: postId}).locator).toHaveCount(0);
        await expect(recipientApp.center.postList.locator).not.toContainText(message);
    });

    test('MM-66742_18 sender sees timer after all recipients reveal', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with short duration
        const {user, team, adminClient} = await setupBorTest(pw, {
            durationSeconds: 60,
        });

        // # Create one recipient and a private channel with exactly 2 members (sender + recipient)
        const recipient = await createSecondUser(pw, adminClient, team);
        const channel = await privateChannelWith(pw, adminClient, team, [user, recipient], 'bor-timer-test');

        // # Login as sender and post BoR message in the controlled channel
        const senderApp = await openChannel(pw, user, {team, channel});
        const {id: postId, post: senderPost} = await sendBorMessage(senderApp, `Timer test ${pw.random.id()}`);

        // * Verify sender sees badge with exactly 1 recipient (not timer yet)
        await expect(senderPost.burnOnReadButton).toBeVisible();
        await expect(senderPost.burnOnReadTimerButton).not.toBeVisible();
        expect(await recipientCount(senderPost)).toEqual({revealed: 0, total: 1});

        // # Login as recipient and reveal
        const recipientApp = await openChannel(pw, recipient, {team, channel});
        const recipientPost = recipientApp.center.postList.post({id: postId});
        await reveal(recipientPost);

        // * Verify recipient sees timer chip (their countdown started)
        await expect(recipientPost.burnOnReadTimerButton).toBeVisible();

        // # Refresh sender's view
        await senderApp.page.reload();

        // * Verify sender now sees timer chip (all 1 recipient revealed, so sender timer starts)
        await expect(senderPost.burnOnReadTimerButton).toBeVisible();
        await expect(senderPost.burnOnReadButton).not.toBeVisible();

        // * Verify timer is counting down
        await expect(senderPost.burnOnReadTimerButton).toHaveText(/\d+:\d+/);
    });
});
