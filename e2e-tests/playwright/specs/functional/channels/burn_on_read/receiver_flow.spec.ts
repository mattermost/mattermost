// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser} from './support';

test.describe('Burn-on-Read Receiver Flow', () => {
    test('MM-66742_9 receiver sees concealed placeholder and reveals message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create a DM channel between sender and receiver for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and navigate to DM
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();

        // # Post BoR message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const secretMessage = `Secret message ${await pw.random.id()}`;
        await senderPage.postMessage(secretMessage);

        // # Login as receiver in new context
        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        // # Get the BoR post
        const borPost = await receiverPage.getLastPost();

        // * Verify post is concealed (placeholder shown)
        await expect(borPost.concealedPlaceholder.container).toBeVisible();

        // * Verify the actual message is NOT visible
        await expect(borPost.body).not.toContainText(secretMessage);

        // * Verify concealed placeholder has correct text
        const placeholderText = await borPost.concealedPlaceholder.getText();
        expect(placeholderText).toContain('View message');

        // # Click to reveal
        await borPost.concealedPlaceholder.clickToReveal();

        // * Wait for reveal to complete
        await borPost.concealedPlaceholder.waitForReveal();

        // * Verify message is now visible
        await expect(borPost.body).toContainText(secretMessage);

        // * Verify concealed placeholder is no longer visible
        await expect(borPost.concealedPlaceholder.container).not.toBeVisible();
    });

    test('MM-66742_10 receiver manually burns revealed message via timer chip', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `To be burned ${await pw.random.id()}`;
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
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver
            const receiver = await createSecondUser(pw, adminClient, team);

            // # Create DM for controlled environment
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and post BoR message
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const message = `Test message ${await pw.random.id()}`;
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

    test('MM-66742_12 timer chip displays countdown after reveal', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with 60 second duration
        const {
            user: sender,
            team,
            adminClient,
        } = await setupBorTest(pw, {
            durationSeconds: 60,
        });

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Timer test ${await pw.random.id()}`;
        await senderPage.postMessage(message);

        // # Login as receiver
        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        // # Get the BoR post and reveal it
        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        // * Verify timer chip is visible (wait for WebSocket update)
        await expect(borPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});

        // * Get initial time
        const initialTime = await borPost.burnOnReadTimerChip.getTimeRemaining();

        // * Verify time format is correct (MM:SS or M:SS)
        expect(initialTime).toMatch(/^\d+:\d{2}$/);

        // # Wait 2 seconds
        await receiverPage.page.waitForTimeout(2000);

        // * Get updated time
        const updatedTime = await borPost.burnOnReadTimerChip.getTimeRemaining();

        // * Verify time has decreased
        expect(updatedTime).toMatch(/^\d+:\d{2}$/);
        // Parse times to compare
        const parseTime = (t: string) => {
            const [m, s] = t.split(':').map(Number);
            return m * 60 + s;
        };
        expect(parseTime(updatedTime)).toBeLessThan(parseTime(initialTime));
    });

    test('MM-66742_13 message auto-deletes after timer expires', {tag: [BOR_TAG]}, async ({pw}, testInfo) => {
        testInfo.setTimeout(120000);
        // # Initialize setup with very short duration (10 seconds)
        const {
            user: sender,
            team,
            adminClient,
        } = await setupBorTest(pw, {
            durationSeconds: 10,
            maxTTLSeconds: 300,
        });

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Auto-delete test ${await pw.random.id()}`;
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

        // * Verify message is visible and timer is running (wait for WebSocket update)
        await expect(borPost.body).toContainText(message);
        await expect(borPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});

        // # Wait for timer to expire (10 seconds + buffer)
        // Use polling to check for post removal
        await expect(async () => {
            const postLocator = receiverPage.page.locator(`[id="post_${postId}"]`);
            await expect(postLocator).not.toBeVisible();
        }).toPass({
            timeout: 20000,
            intervals: [1000],
        });

        // * Verify message is no longer visible
        const deletedPostLocator = receiverPage.page.locator(`[id="post_${postId}"]`);
        await expect(deletedPostLocator).not.toBeVisible();

        // * Verify message text is not in the channel
        const pageContent = await receiverPage.centerView.container.textContent();
        expect(pageContent).not.toContain(message);
    });

    test('MM-66742_14 receiver sees flame badge on concealed message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name);
        await senderPage.toBeVisible();
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Badge test ${await pw.random.id()}`;
        await senderPage.postMessage(message);

        // # Login as receiver
        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name);
        await receiverPage.toBeVisible();
        await receiverPage.goto(team.name, `@${sender.username}`);

        // # Get the BoR post (still concealed)
        const borPost = await receiverPage.getLastPost();

        // * Verify concealed placeholder is visible
        await expect(borPost.concealedPlaceholder.container).toBeVisible();

        // * Verify flame badge is also visible on concealed post
        await expect(borPost.burnOnReadBadge.container).toBeVisible();

        // * Verify badge tooltip shows appropriate message for receiver
        const ariaLabel = await borPost.burnOnReadBadge.getAriaLabel();
        expect(ariaLabel).toContain('Burn-on-read message');
    });
});
