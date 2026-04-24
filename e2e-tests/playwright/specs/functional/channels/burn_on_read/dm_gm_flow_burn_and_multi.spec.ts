// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM} from './support';

test.describe('Burn-on-Read in DMs and GMs', () => {
    test('MM-66742_4 sender deletes BoR in DM and recipient cannot see it', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and navigate to DM
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name);
        await senderPage.toBeVisible();
        await senderPage.goto(team.name, `@${receiver.username}`);

        // # Enable BoR and send message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const secretMessage = `To be deleted ${pw.random.id()}`;
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
    });

    test('MM-66742_5 receiver burns revealed BoR in DM via timer chip', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and navigate to DM
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();

        // # Enable BoR and send message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const secretMessage = `Receiver will burn ${pw.random.id()}`;
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
    });

    test('MM-66742_7 multiple BoR messages in same DM conversation', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();

        // # Send first BoR message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message1 = `First BoR ${pw.random.id()}`;
        await senderPage.postMessage(message1);

        // # Send second BoR message (toggle again to ensure BoR is on)
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message2 = `Second BoR ${pw.random.id()}`;
        await senderPage.postMessage(message2);

        // # Login as receiver and verify they can see concealed messages
        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        // Wait for posts to load - at least one concealed placeholder should be visible
        await expect(receiverPage.centerView.container.locator('.BurnOnReadConcealedPlaceholder').first()).toBeVisible({
            timeout: 10000,
        });

        // * Get all concealed placeholders
        const concealedPlaceholders = receiverPage.centerView.container.locator('.BurnOnReadConcealedPlaceholder');
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
    });
});
