// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM} from './support';

test.describe('Burn-on-Read Receiver Flow', () => {
    test('MM-66742_10 receiver manually burns revealed message via timer chip', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `To be burned ${pw.random.id()}`;
        await senderPage.postMessage(message);

        // # Login as receiver
        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        // # Get the BoR post and reveal it
        const borPost = await receiverPage.getLastPost();
        const postId = await borPost.getId();

        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        // * Verify message is revealed
        await expect(borPost.body).toContainText(message);

        // * Wait for timer chip to appear (WebSocket update)
        await expect(borPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});

        // # Click timer chip to manually burn
        await borPost.burnOnReadTimerChip.click();

        // * Verify confirmation modal appears
        await expect(receiverPage.burnOnReadConfirmationModal.container).toBeVisible();

        // # Confirm deletion
        await receiverPage.burnOnReadConfirmationModal.confirm();

        // * Verify post is removed from receiver's view
        const deletedPostLocator = receiverPage.page.locator(`[id="post_${postId}"]`);
        await expect(deletedPostLocator).not.toBeVisible();
    });

    test(
        'MM-66742_11 receiver uses dont show again preference for burn confirmation',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled + DM between sender and receiver
            const {sender, receiver, team} = await setupBorDM(pw);

            // # Login as sender and post BoR message
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message = `Test message ${pw.random.id()}`;
            await senderPage.postMessage(message);

            // # Login as receiver
            const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
            await receiverPage.goto(team.name, `@${sender.username}`);
            await receiverPage.toBeVisible();

            // # Reveal the message
            const borPost = await receiverPage.getLastPost();
            await borPost.concealedPlaceholder.clickToReveal();
            await borPost.concealedPlaceholder.waitForReveal();

            // * Wait for timer chip to be visible
            await expect(borPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});

            // # Click timer to burn
            await borPost.burnOnReadTimerChip.click();

            // * Verify confirmation modal appears
            await expect(receiverPage.burnOnReadConfirmationModal.container).toBeVisible();

            // * Verify "don't show again" checkbox is available
            await expect(receiverPage.burnOnReadConfirmationModal.dontShowAgainCheckbox).toBeVisible();

            // # Check "don't show again" and confirm (combined action)
            await receiverPage.burnOnReadConfirmationModal.confirmWithDontShowAgain();

            // * Verify post is deleted
            await expect(borPost.container).not.toBeVisible({timeout: 10000});
        },
    );
});
