// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser, createPrivateChannelWithMembers} from './support';

test.describe('Burn-on-Read Sender Flow', () => {
    test('MM-66742_17 sender manually deletes for all recipients', {tag: [BOR_TAG]}, async ({pw}) => {
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
    });

    test('MM-66742_18 sender sees timer after all recipients reveal', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with short duration
        const {user, team, adminClient} = await setupBorTest(pw, {
            durationSeconds: 60,
        });

        // # Create one recipient
        const recipient = await createSecondUser(pw, adminClient, team);

        // # Create a private channel with exactly 2 members (sender + recipient)
        const channel = await createPrivateChannelWithMembers(pw, adminClient, team, [user.id, recipient.id], {
            name: 'bor-timer-test',
            displayName: 'BoR Timer Test',
        });

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
    });
});
