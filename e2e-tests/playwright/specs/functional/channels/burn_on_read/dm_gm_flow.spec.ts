// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, openChannel, test, duration} from '@mattermost/playwright-lib';

import {
    BOR_TAG,
    createSecondUser,
    lastPost,
    openDm,
    recipientCount,
    reveal,
    sendBorMessage,
    sendMessage,
    setupBorTest,
} from './support';

test.describe('Burn-on-Read in DMs and GMs', () => {
    test('MM-66742_1 BoR toggle is available in DM channel', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user, team, adminClient} = await setupBorTest(pw);

        // # Create second user for DM
        const otherUser = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([user.id, otherUser.id]);

        // # Login and navigate to DM
        const app = await openDm(pw, user, team, otherUser);

        // * Verify BoR toggle button is available
        await expect(app.center.postCreate.burnOnReadButton.locator).toBeAttached();
        await expect(app.center.postCreate.burnOnReadButton).toBeEnabled();

        // # Toggle BoR on
        await app.center.postCreate.burnOnReadButton.click();
        await expect(app.center.postCreate.burnOnReadLabel).toBeVisible();

        // * Verify BoR label appears indicating it's enabled
        await expect(app.center.postCreate.burnOnReadLabel).toBeVisible();
    });

    test('MM-66742_2 complete BoR flow in DM between two users', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and navigate to DM
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Enable BoR and send message
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const secretMessage = `DM secret ${pw.random.id()}`;
        await sendMessage(senderApp, secretMessage);

        // # Get sender's view of the post
        const {post: senderPost} = await lastPost(senderApp);

        // * Verify sender sees the message content (not concealed)
        await expect(senderPost.body).toContainText(secretMessage);

        // * Verify sender sees flame badge
        await expect(senderPost.burnOnReadButton).toBeVisible();

        // # Login as receiver and navigate to DM
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Get receiver's view of the post
        const {post: receiverPost} = await lastPost(receiverApp);

        // * Verify receiver sees concealed placeholder
        await expect(receiverPost.revealButton).toBeVisible();

        // * Verify receiver does NOT see the message content
        await expect(receiverPost.body).not.toContainText(secretMessage);

        // # Reveal the message
        await receiverPost.revealButton.click();
        await expect(receiverPost.revealButton).not.toBeVisible();

        // * Verify receiver now sees the message content
        await expect(receiverPost.body).toContainText(secretMessage);

        // * Verify timer chip appears (wait for WebSocket update)
        await expect(receiverPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});
    });

    test(
        'MM-66742_3 BoR message in group message with multiple recipients',
        {tag: [BOR_TAG]},
        async ({pw}, testInfo) => {
            testInfo.setTimeout(duration.two_min);
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create two other users for the group
            const recipient1 = await createSecondUser(pw, adminClient, team);
            const recipient2 = await createSecondUser(pw, adminClient, team);

            // # Create a private channel with exactly 3 members (sender + 2 recipients)
            // This gives us control over the exact member count
            const channelSuffix = Date.now().toString(36);
            const channel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: `bor-gm-test-${channelSuffix}`,
                    displayName: `BoR GM Test ${channelSuffix}`,
                    type: 'P', // Private channel
                }),
            );

            // Add all test users to the channel
            await adminClient.addToChannel(sender.id, channel.id);
            await adminClient.addToChannel(recipient1.id, channel.id);
            await adminClient.addToChannel(recipient2.id, channel.id);

            // Remove admin from channel (auto-added as creator)
            const adminUser = await adminClient.getMe();
            await adminClient.removeFromChannel(adminUser.id, channel.id);

            // # Login as sender and navigate to the channel
            const senderApp = await openChannel(pw, sender, {team, channel});

            // # Enable BoR and send message
            await senderApp.center.postCreate.burnOnReadButton.click();
            await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
            const secretMessage = `GM secret ${pw.random.id()}`;
            await sendMessage(senderApp, secretMessage);

            // # Get sender's view
            const {post: senderPost} = await lastPost(senderApp);

            // * Verify sender sees flame badge
            await expect(senderPost.burnOnReadButton).toBeVisible();

            // * Verify tooltip shows 0 of 2 recipients (channel has 3 members - 1 sender = 2 recipients)
            const tooltipText = (await senderPost.burnOnReadButton.locator.getAttribute('aria-label')) ?? '';
            expect(tooltipText).toContain('Read by 0 of 2');

            // # Login as first recipient and reveal
            const recipient1App = await openChannel(pw, recipient1, {team, channel});

            const {post: recipient1Post} = await lastPost(recipient1App);
            await recipient1Post.revealButton.click();
            await expect(recipient1Post.revealButton).not.toBeVisible();

            // * Verify first recipient sees message and timer (wait for WebSocket update)
            await expect(recipient1Post.body).toContainText(secretMessage);
            await expect(recipient1Post.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});

            // # Refresh sender and verify updated count
            await senderApp.page.reload();
            await expect(senderApp.center.postCreate.message).toBeVisible();
            const {post: updatedSenderPost} = await lastPost(senderApp);
            await updatedSenderPost.burnOnReadButton.hover();
            await expect(updatedSenderPost.burnOnReadButton.locator).toHaveAttribute('aria-label', /Read by 1 of 2/);

            // # Login as second recipient and reveal
            const recipient2App = await openChannel(pw, recipient2, {team, channel});

            const {post: recipient2Post} = await lastPost(recipient2App);
            await recipient2Post.revealButton.click();
            await expect(recipient2Post.revealButton).not.toBeVisible();

            // * Verify second recipient sees message and timer (wait for WebSocket update)
            await expect(recipient2Post.body).toContainText(secretMessage);
            await expect(recipient2Post.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});
        },
    );

    test('MM-66742_4 sender deletes BoR in DM and recipient cannot see it', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and navigate to DM
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Enable BoR and send message
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const secretMessage = `To be deleted ${pw.random.id()}`;
        await sendMessage(senderApp, secretMessage);

        // # Get the post ID
        const {id: senderPostId, post: senderPost} = await lastPost(senderApp);
        const postId = senderPostId;

        // # Sender clicks flame badge to delete
        await senderPost.burnOnReadButton.click();

        // * Verify confirmation modal appears
        await expect(senderApp.burnOnReadConfirmationModal.confirmButton).toBeVisible();

        // # Confirm deletion
        await senderApp.burnOnReadConfirmationModal.confirmButton.click();

        // * Verify post is removed from sender's view
        const deletedPostSender = senderApp.center.postList.post({id: postId}).locator;
        await expect(deletedPostSender).not.toBeVisible();

        // # Login as receiver and verify message is not there
        const receiverApp = await openDm(pw, receiver, team, sender);

        // * Verify the deleted message is not visible to receiver
        const deletedPostReceiver = receiverApp.center.postList.post({id: postId}).locator;
        await expect(deletedPostReceiver).not.toBeVisible();

        // * Verify message content is not in the channel
        const channelContent = await receiverApp.center.postList.locator.textContent();
        expect(channelContent).not.toContain(secretMessage);
    });

    test('MM-66742_5 receiver burns revealed BoR in DM via timer chip', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and navigate to DM
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Enable BoR and send message
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const secretMessage = `Receiver will burn ${pw.random.id()}`;
        await sendMessage(senderApp, secretMessage);

        // # Login as receiver
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Reveal the message
        const {id: receiverPostId, post: receiverPost} = await lastPost(receiverApp);
        const postId = receiverPostId;
        await receiverPost.revealButton.click();
        await expect(receiverPost.revealButton).not.toBeVisible();

        // * Verify message is revealed
        await expect(receiverPost.body).toContainText(secretMessage);

        // * Wait for timer chip to appear (WebSocket update)
        await expect(receiverPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});

        // # Click timer to burn
        await receiverPost.burnOnReadTimerButton.click();

        // * Verify confirmation modal
        await expect(receiverApp.burnOnReadConfirmationModal.confirmButton).toBeVisible();

        // # Confirm
        await receiverApp.burnOnReadConfirmationModal.confirmButton.click();

        // * Verify post is removed from receiver's view
        const deletedPostReceiver = receiverApp.center.postList.post({id: postId}).locator;
        await expect(deletedPostReceiver).not.toBeVisible({timeout: duration.half_min});

        // * Verify message content is not visible in the channel
        await expect(receiverApp.center.postList.locator).not.toContainText(secretMessage);
    });

    test('MM-66742_6 DM shows correct recipient count of 1', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and navigate to DM
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Enable BoR and send message
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const secretMessage = `Count test ${pw.random.id()}`;
        await sendMessage(senderApp, secretMessage);

        // # Get sender's view
        const {post: senderPost} = await lastPost(senderApp);

        // * Verify tooltip shows exactly 1 recipient
        await senderPost.burnOnReadButton.hover();
        await expect(senderPost.burnOnReadButton.locator).toHaveAttribute('aria-label', /Read by/);
        const counts = await recipientCount(senderPost);
        expect(counts.total).toBe(1);
        expect(counts.revealed).toBe(0);
    });

    test('MM-66742_7 multiple BoR messages in same DM conversation', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Send two BoR messages (toggling BoR on for each, since it resets after a send)
        const message1 = `First BoR ${pw.random.id()}`;
        const {id: firstId} = await sendBorMessage(senderApp, message1);
        const message2 = `Second BoR ${pw.random.id()}`;
        const {id: secondId} = await sendBorMessage(senderApp, message2);

        // # Login as receiver
        const receiverApp = await openDm(pw, receiver, team, sender);

        // * Verify both messages are concealed, then reveal each one
        for (const [id, message] of [
            [firstId, message1],
            [secondId, message2],
        ]) {
            const post = receiverApp.center.postList.post({id});
            await expect(post.revealButton).toBeVisible();
            await expect(post).not.toContainText(message);
            await reveal(post);

            // * Verify the message is visible after revealing
            await expect(post.message).toContainText(message);
        }
    });

    test('MM-66742_8 BoR toggle resets after sending message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM channel
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Enable BoR toggle
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();

        // * Verify BoR is enabled
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();

        // # Send a message
        const message1 = `BoR message ${pw.random.id()}`;
        await sendMessage(senderApp, message1);

        // * Verify BoR is disabled after sending (toggle resets)
        await expect(senderApp.center.postCreate.burnOnReadLabel).not.toBeVisible();

        // * Verify the sent message has BoR badge (was sent as BoR)
        const {post: sentPost} = await lastPost(senderApp);
        await expect(sentPost.burnOnReadButton).toBeVisible();
    });
});
