// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser} from './support';

test.describe('Burn-on-Read Sender Flow', () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify sender can send a BoR message and see the sent status
     * with flame badge showing recipient count
     */
    test(
        'sends BoR message and views sent status with recipient count',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user, team, adminClient} = await setupBorTest(pw);

            // # Create second user as recipient
            const recipient = await createSecondUser(pw, adminClient, team);

            // # Login as sender
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Enable BoR toggle in composer
            await channelsPage.centerView.postCreate.toggleBurnOnRead();

            // * Verify BoR label appears
            await expect(channelsPage.centerView.postCreate.burnOnReadLabel).toBeVisible();

            // # Send BoR message
            const message = `BoR Test ${pw.random.id()}`;
            await channelsPage.postMessage(message);

            // # Get the posted message
            const lastPost = await channelsPage.getLastPost();

            // * Verify post has BoR badge
            await expect(lastPost.burnOnReadBadge.container).toBeVisible();

            // * Verify flame icon is displayed
            await expect(lastPost.burnOnReadBadge.flameIcon).toBeVisible();

            // # Hover over badge to see tooltip
            await lastPost.burnOnReadBadge.hover();

            // * Verify tooltip shows recipient info
            const tooltipText = await lastPost.burnOnReadBadge.getTooltipText();
            expect(tooltipText).toContain('Read by 0 of');
            expect(tooltipText).toContain('Click to delete');
        },
    );

    /**
     * @objective Verify sender sees read receipts in tooltip when recipients reveal the message
     */
    test(
        'sender sees read receipts in tooltip',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user, team, adminClient} = await setupBorTest(pw);

            // # Create two recipients
            const recipient1 = await createSecondUser(pw, adminClient, team);
            const recipient2 = await createSecondUser(pw, adminClient, team);

            // # Create a private channel with exactly these 3 users (sender + 2 recipients)
            // Use timestamp to ensure unique channel name across test runs
            const channelSuffix = Date.now().toString(36);
            const channel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: `bor-test-${channelSuffix}`,
                    displayName: `BoR Test ${channelSuffix}`,
                    type: 'P', // Private channel
                }),
            );

            // Add all test users to the channel
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.addToChannel(recipient1.id, channel.id);
            await adminClient.addToChannel(recipient2.id, channel.id);

            // Remove admin from channel (they were auto-added as creator)
            // This ensures exactly 3 members: sender + 2 recipients
            const adminUser = await adminClient.getMe();
            await adminClient.removeFromChannel(adminUser.id, channel.id);

            // # Login as sender and navigate to the new channel
            const {channelsPage: senderPage} = await pw.testBrowser.login(user);
            await senderPage.goto(team.name, channel.name);
            await senderPage.toBeVisible();

            // # Post BoR message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message = `Secret message ${pw.random.id()}`;
            await senderPage.postMessage(message);

            // # Get sender's post
            let senderPost = await senderPage.getLastPost();

            // * Verify initial state shows 0 recipients revealed
            await senderPost.burnOnReadBadge.hover();
            let recipientCount = await senderPost.burnOnReadBadge.getRecipientCount();
            expect(recipientCount.revealed).toBe(0);
            expect(recipientCount.total).toBe(2); // Should be 2 recipients (channel has 3 members - 1 sender)

            // # Login as first recipient and reveal the message
            const {channelsPage: recipient1Page} = await pw.testBrowser.login(recipient1);
            await recipient1Page.goto(team.name, channel.name);
            await recipient1Page.toBeVisible();
            const recipient1Post = await recipient1Page.getLastPost();
            await recipient1Post.concealedPlaceholder.clickToReveal();
            await recipient1Post.concealedPlaceholder.waitForReveal();

            // # Refresh sender's view and check updated count
            await senderPage.page.reload();
            await senderPage.toBeVisible();
            senderPost = await senderPage.getLastPost();
            await senderPost.burnOnReadBadge.hover();
            recipientCount = await senderPost.burnOnReadBadge.getRecipientCount();
            expect(recipientCount.revealed).toBe(1);

            // # Login as second recipient and reveal the message
            const {channelsPage: recipient2Page} = await pw.testBrowser.login(recipient2);
            await recipient2Page.goto(team.name, channel.name);
            await recipient2Page.toBeVisible();
            const recipient2Post = await recipient2Page.getLastPost();
            await recipient2Post.concealedPlaceholder.clickToReveal();
            await recipient2Post.concealedPlaceholder.waitForReveal();

            // # Refresh sender's view and check final count
            await senderPage.page.reload();
            await senderPage.toBeVisible();
            senderPost = await senderPage.getLastPost();
            await senderPost.burnOnReadBadge.hover();
            recipientCount = await senderPost.burnOnReadBadge.getRecipientCount();
            expect(recipientCount.revealed).toBe(2);
        },
    );

    /**
     * @objective Verify sender can manually delete BoR message for all recipients
     */
    test(
        'sender manually deletes for all recipients',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user, team, adminClient} = await setupBorTest(pw);

            // # Create recipient
            const recipient = await createSecondUser(pw, adminClient, team);

            // # Login as sender and post BoR message
            const {channelsPage: senderPage} = await pw.testBrowser.login(user);
            await senderPage.goto(team.name, 'town-square');
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message = `To be deleted ${pw.random.id()}`;
            await senderPage.postMessage(message);

            // # Get the post and its ID for verification later
            const senderPost = await senderPage.getLastPost();
            const postId = await senderPost.getId();

            // # Click flame badge to delete
            await senderPost.burnOnReadBadge.click();

            // * Verify confirmation modal appears
            await expect(senderPage.burnOnReadConfirmationModal.container).toBeVisible();

            // # Confirm deletion
            await senderPage.burnOnReadConfirmationModal.confirm();

            // * Verify the specific post is removed from sender's view
            // Use attribute selector to handle special characters in post ID (colons, etc.)
            const deletedPostLocator = senderPage.page.locator(`[id="post_${postId}"]`);
            await expect(deletedPostLocator).not.toBeVisible();

            // # Login as recipient and verify post is not visible
            const {channelsPage: recipientPage} = await pw.testBrowser.login(recipient);
            await recipientPage.goto(team.name, 'town-square');

            // * Verify the deleted message is not in the channel
            const posts = await recipientPage.centerView.container.locator('.post').all();
            for (const post of posts) {
                const text = await post.textContent();
                expect(text).not.toContain(message);
            }
        },
    );

    /**
     * @objective Verify sender sees timer chip after all recipients reveal
     *
     * SKIPPED: There's an issue with sender's expire_at not being returned after page refresh.
     * The sender's timer state may only update via WebSocket and not persist after reload.
     * This will be fixed in a future update.
     */
    test.skip(
        'sender sees timer after all recipients reveal',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with short duration
            const {user, team, adminClient} = await setupBorTest(pw, {
                durationSeconds: 60,
            });

            // # Create one recipient
            const recipient = await createSecondUser(pw, adminClient, team);

            // # Create a private channel with exactly 2 members (sender + recipient)
            const channelSuffix = Date.now().toString(36);
            const channel = await adminClient.createChannel(
                pw.random.channel({
                    teamId: team.id,
                    name: `bor-timer-test-${channelSuffix}`,
                    displayName: `BoR Timer Test ${channelSuffix}`,
                    type: 'P',
                }),
            );

            // Add sender and recipient to the channel
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.addToChannel(recipient.id, channel.id);

            // Remove admin from channel (they were auto-added as creator)
            const adminUser = await adminClient.getMe();
            await adminClient.removeFromChannel(adminUser.id, channel.id);

            // # Login as sender and post BoR message in the controlled channel
            const {channelsPage: senderPage} = await pw.testBrowser.login(user);
            await senderPage.goto(team.name, channel.name);
            await senderPage.toBeVisible();
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message = `Timer test ${pw.random.id()}`;
            await senderPage.postMessage(message);

            // # Get sender's post
            let senderPost = await senderPage.getLastPost();

            // * Verify sender sees badge with exactly 1 recipient (not timer yet)
            await expect(senderPost.burnOnReadBadge.container).toBeVisible();
            await expect(senderPost.burnOnReadTimerChip.container).not.toBeVisible();

            // * Verify recipient count is exactly 1 (our controlled channel)
            const initialCount = await senderPost.burnOnReadBadge.getRecipientCount();
            expect(initialCount.total).toBe(1);
            expect(initialCount.revealed).toBe(0);

            // # Login as recipient and reveal
            const {channelsPage: recipientPage} = await pw.testBrowser.login(recipient);
            await recipientPage.goto(team.name, channel.name);
            await recipientPage.toBeVisible();

            // Get the BoR post (last post in our controlled channel)
            const recipientPost = await recipientPage.getLastPost();
            await recipientPost.concealedPlaceholder.clickToReveal();
            await recipientPost.concealedPlaceholder.waitForReveal();

            // * Verify recipient sees timer chip (their countdown started)
            await expect(recipientPost.burnOnReadTimerChip.container).toBeVisible();

            // # Refresh sender's view
            await senderPage.page.reload();
            await senderPage.toBeVisible();

            // Get the BoR post (last post in our controlled channel)
            senderPost = await senderPage.getLastPost();

            // * Verify sender now sees timer chip (all 1 recipient revealed, so sender timer starts)
            await expect(senderPost.burnOnReadTimerChip.container).toBeVisible();
            await expect(senderPost.burnOnReadBadge.container).not.toBeVisible();

            // * Verify timer is counting down
            const timeRemaining = await senderPost.burnOnReadTimerChip.getTimeRemaining();
            expect(timeRemaining).toMatch(/\d+:\d+/);
        },
    );
});

