// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser} from './support';

test.describe('Burn-on-Read in DMs and GMs', () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify BoR toggle is available in Direct Messages
     */
    test(
        'BoR toggle is available in DM channel',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user, team, adminClient} = await setupBorTest(pw);

            // # Create second user for DM
            const otherUser = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([user.id, otherUser.id]);

            // # Login and navigate to DM
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();
            await channelsPage.goto(team.name, `@${otherUser.username}`);

            // * Verify BoR toggle button is available
            await expect(channelsPage.centerView.postCreate.burnOnReadButton).toBeVisible();

            // # Toggle BoR on
            await channelsPage.centerView.postCreate.toggleBurnOnRead();

            // * Verify BoR label appears indicating it's enabled
            await expect(channelsPage.centerView.postCreate.burnOnReadLabel).toBeVisible();
        },
    );

    /**
     * @objective Verify complete BoR flow in a Direct Message
     * Sender sends, receiver reveals and sees timer
     */
    test(
        'complete BoR flow in DM between two users',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and navigate to DM
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name);
            await senderPage.toBeVisible();
            await senderPage.goto(team.name, `@${receiver.username}`);

            // # Enable BoR and send message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const secretMessage = `DM secret ${await pw.random.id()}`;
            await senderPage.postMessage(secretMessage);

            // # Get sender's view of the post
            const senderPost = await senderPage.getLastPost();

            // * Verify sender sees the message content (not concealed)
            await expect(senderPost.body).toContainText(secretMessage);

            // * Verify sender sees flame badge
            await expect(senderPost.burnOnReadBadge.container).toBeVisible();

            // # Login as receiver and navigate to DM
            const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
            await receiverPage.goto(team.name);
            await receiverPage.toBeVisible();
            await receiverPage.goto(team.name, `@${sender.username}`);

            // # Get receiver's view of the post
            const receiverPost = await receiverPage.getLastPost();

            // * Verify receiver sees concealed placeholder
            await expect(receiverPost.concealedPlaceholder.container).toBeVisible();

            // * Verify receiver does NOT see the message content
            await expect(receiverPost.body).not.toContainText(secretMessage);

            // # Reveal the message
            await receiverPost.concealedPlaceholder.clickToReveal();
            await receiverPost.concealedPlaceholder.waitForReveal();

            // * Verify receiver now sees the message content
            await expect(receiverPost.body).toContainText(secretMessage);

            // * Verify timer chip appears (wait for WebSocket update)
            await expect(receiverPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});
        },
    );

    /**
     * @objective Verify BoR works in Group Messages with multiple recipients
     * Note: Uses a private channel to control member count exactly
     */
    test(
        'BoR message in group message with multiple recipients',
        {tag: [BOR_TAG]},
        async ({pw}) => {
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
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, channel.name);
            await senderPage.toBeVisible();

            // # Enable BoR and send message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const secretMessage = `GM secret ${await pw.random.id()}`;
            await senderPage.postMessage(secretMessage);

            // # Get sender's view
            const senderPost = await senderPage.getLastPost();

            // * Verify sender sees flame badge
            await expect(senderPost.burnOnReadBadge.container).toBeVisible();

            // * Verify tooltip shows 0 of 2 recipients (channel has 3 members - 1 sender = 2 recipients)
            const tooltipText = await senderPost.burnOnReadBadge.getTooltipText();
            expect(tooltipText).toContain('Read by 0 of 2');

            // # Login as first recipient and reveal
            const {channelsPage: recipient1Page} = await pw.testBrowser.login(recipient1);
            await recipient1Page.goto(team.name, channel.name);
            await recipient1Page.toBeVisible();

            const recipient1Post = await recipient1Page.getLastPost();
            await recipient1Post.concealedPlaceholder.clickToReveal();
            await recipient1Post.concealedPlaceholder.waitForReveal();

            // * Verify first recipient sees message and timer (wait for WebSocket update)
            await expect(recipient1Post.body).toContainText(secretMessage);
            await expect(recipient1Post.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});

            // # Refresh sender and verify updated count
            await senderPage.page.reload();
            await senderPage.toBeVisible();
            const updatedSenderPost = await senderPage.getLastPost();
            await updatedSenderPost.burnOnReadBadge.hover();
            const updatedTooltip = await updatedSenderPost.burnOnReadBadge.getTooltipText();
            expect(updatedTooltip).toContain('Read by 1 of 2');

            // # Login as second recipient and reveal
            const {channelsPage: recipient2Page} = await pw.testBrowser.login(recipient2);
            await recipient2Page.goto(team.name, channel.name);
            await recipient2Page.toBeVisible();

            const recipient2Post = await recipient2Page.getLastPost();
            await recipient2Post.concealedPlaceholder.clickToReveal();
            await recipient2Post.concealedPlaceholder.waitForReveal();

            // * Verify second recipient sees message and timer (wait for WebSocket update)
            await expect(recipient2Post.body).toContainText(secretMessage);
            await expect(recipient2Post.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});
        },
    );

    /**
     * @objective Verify BoR message deletion in DM removes for both parties
     */
    test(
        'sender deletes BoR in DM and recipient cannot see it',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and navigate to DM
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name);
            await senderPage.toBeVisible();
            await senderPage.goto(team.name, `@${receiver.username}`);

            // # Enable BoR and send message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const secretMessage = `To be deleted ${await pw.random.id()}`;
            await senderPage.postMessage(secretMessage);

            // # Get the post ID
            const senderPost = await senderPage.getLastPost();
            const postId = await senderPost.getId();

            // # Sender clicks flame badge to delete
            await senderPost.burnOnReadBadge.click();

            // * Verify confirmation modal appears
            await expect(senderPage.burnOnReadConfirmationModal.container).toBeVisible();

            // # Confirm deletion
            await senderPage.burnOnReadConfirmationModal.confirm();

            // * Verify post is removed from sender's view
            const deletedPostSender = senderPage.page.locator(`[id="post_${postId}"]`);
            await expect(deletedPostSender).not.toBeVisible();

            // # Login as receiver and verify message is not there
            const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
            await receiverPage.goto(team.name);
            await receiverPage.toBeVisible();
            await receiverPage.goto(team.name, `@${sender.username}`);

            // * Verify the deleted message is not visible to receiver
            const deletedPostReceiver = receiverPage.page.locator(`[id="post_${postId}"]`);
            await expect(deletedPostReceiver).not.toBeVisible();

            // * Verify message content is not in the channel
            const channelContent = await receiverPage.centerView.container.textContent();
            expect(channelContent).not.toContain(secretMessage);
        },
    );

    /**
     * @objective Verify receiver can burn BoR in DM after revealing
     */
    test(
        'receiver burns revealed BoR in DM via timer chip',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and navigate to DM
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            // # Enable BoR and send message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const secretMessage = `Receiver will burn ${await pw.random.id()}`;
            await senderPage.postMessage(secretMessage);

            // # Login as receiver
            const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
            await receiverPage.goto(team.name, `@${sender.username}`);
            await receiverPage.toBeVisible();

            // # Reveal the message
            const receiverPost = await receiverPage.getLastPost();
            const postId = await receiverPost.getId();
            await receiverPost.concealedPlaceholder.clickToReveal();
            await receiverPost.concealedPlaceholder.waitForReveal();

            // * Verify message is revealed
            await expect(receiverPost.body).toContainText(secretMessage);

            // * Wait for timer chip to appear (WebSocket update)
            await expect(receiverPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});

            // # Click timer to burn
            await receiverPost.burnOnReadTimerChip.click();

            // * Verify confirmation modal
            await expect(receiverPage.burnOnReadConfirmationModal.container).toBeVisible();

            // # Confirm
            await receiverPage.burnOnReadConfirmationModal.confirm();

            // * Verify post is removed from receiver's view
            const deletedPostReceiver = receiverPage.page.locator(`[id="post_${postId}"]`);
            await expect(deletedPostReceiver).not.toBeVisible({timeout: 15000});

            // * Verify message content is not visible in the channel
            await expect(receiverPage.centerView.container).not.toContainText(secretMessage);
        },
    );

    /**
     * @objective Verify DM shows correct recipient count (should be 1 for DM)
     */
    test(
        'DM shows correct recipient count of 1',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and navigate to DM
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name);
            await senderPage.toBeVisible();
            await senderPage.goto(team.name, `@${receiver.username}`);

            // # Enable BoR and send message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const secretMessage = `Count test ${await pw.random.id()}`;
            await senderPage.postMessage(secretMessage);

            // # Get sender's view
            const senderPost = await senderPage.getLastPost();

            // * Verify tooltip shows exactly 1 recipient
            await senderPost.burnOnReadBadge.hover();
            const recipientCount = await senderPost.burnOnReadBadge.getRecipientCount();
            expect(recipientCount.total).toBe(1);
            expect(recipientCount.revealed).toBe(0);
        },
    );

    /**
     * @objective Verify multiple BoR messages can be sent in same DM conversation
     * Note: BoR toggle may reset after each message, so we toggle for each
     */
    test(
        'multiple BoR messages in same DM conversation',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            // # Send first BoR message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message1 = `First BoR ${await pw.random.id()}`;
            await senderPage.postMessage(message1);

            // # Send second BoR message (toggle again to ensure BoR is on)
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message2 = `Second BoR ${await pw.random.id()}`;
            await senderPage.postMessage(message2);

            // # Login as receiver and verify they can see concealed messages
            const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
            await receiverPage.goto(team.name, `@${sender.username}`);
            await receiverPage.toBeVisible();

            // Wait for posts to load - at least one concealed placeholder should be visible
            await expect(
                receiverPage.centerView.container.locator('.BurnOnReadConcealedPlaceholder').first(),
            ).toBeVisible({timeout: 10000});

            // * Get all concealed placeholders
            const concealedPlaceholders = receiverPage.centerView.container.locator(
                '.BurnOnReadConcealedPlaceholder',
            );
            const count = await concealedPlaceholders.count();
            expect(count).toBeGreaterThanOrEqual(1);

            // # Reveal all concealed messages
            for (let i = 0; i < count; i++) {
                const placeholder = concealedPlaceholders.nth(i);
                if (await placeholder.isVisible()) {
                    await placeholder.click();
                    // Wait for reveal animation
                    await receiverPage.page.waitForTimeout(500);
                }
            }

            // * Verify at least one of the messages is visible after revealing
            const pageContent = await receiverPage.centerView.container.textContent();
            const hasMessage1 = pageContent?.includes(message1);
            const hasMessage2 = pageContent?.includes(message2);
            expect(hasMessage1 || hasMessage2).toBe(true);
        },
    );

    /**
     * @objective Verify BoR toggle resets after sending a message
     * Note: The BoR toggle is per-message, not sticky - user must enable for each message
     */
    test(
        'BoR toggle resets after sending message',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM channel
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            // # Enable BoR toggle
            await senderPage.centerView.postCreate.toggleBurnOnRead();

            // * Verify BoR is enabled
            const isEnabledBefore = await senderPage.centerView.postCreate.isBurnOnReadEnabled();
            expect(isEnabledBefore).toBe(true);

            // # Send a message
            const message1 = `BoR message ${await pw.random.id()}`;
            await senderPage.postMessage(message1);

            // * Verify BoR is disabled after sending (toggle resets)
            const isEnabledAfter = await senderPage.centerView.postCreate.isBurnOnReadEnabled();
            expect(isEnabledAfter).toBe(false);

            // * Verify the sent message has BoR badge (was sent as BoR)
            const lastPost = await senderPage.getLastPost();
            await expect(lastPost.burnOnReadBadge.container).toBeVisible();
        },
    );
});

