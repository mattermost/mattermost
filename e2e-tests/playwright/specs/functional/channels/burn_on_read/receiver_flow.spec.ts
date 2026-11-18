// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration} from '@mattermost/playwright-lib';

import {BOR_TAG, createSecondUser, lastPost, openDm, parseTimeRemaining, sendMessage, setupBorTest} from './support';

test.describe('Burn-on-Read Receiver Flow', () => {
    test('MM-66742_9 receiver sees concealed placeholder and reveals message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create a DM channel between sender and receiver for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and navigate to DM
        const senderApp = await openDm(pw, sender, team, receiver);

        // # Post BoR message
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const secretMessage = `Secret message ${pw.random.id()}`;
        await sendMessage(senderApp, secretMessage);

        // # Login as receiver in new context
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Get the BoR post
        const {post: borPost} = await lastPost(receiverApp);

        // * Verify post is concealed (placeholder shown)
        await expect(borPost.revealButton).toBeVisible();

        // * Verify the actual message is NOT visible
        await expect(borPost.body).not.toContainText(secretMessage);

        // * Verify concealed placeholder has correct text
        const placeholderText = (await borPost.revealButton.locator.textContent()) ?? '';
        expect(placeholderText).toContain('View message');

        // # Click to reveal
        await borPost.revealButton.click();

        // * Wait for reveal to complete
        await expect(borPost.revealButton).not.toBeVisible();

        // * Verify message is now visible
        await expect(borPost.body).toContainText(secretMessage);

        // * Verify concealed placeholder is no longer visible
        await expect(borPost.revealButton).not.toBeVisible();
    });

    test('MM-66742_10 receiver manually burns revealed message via timer chip', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user: sender, team, adminClient} = await setupBorTest(pw);

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and post BoR message
        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `To be burned ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        // # Login as receiver
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Get the BoR post and reveal it
        const {id: borPostId, post: borPost} = await lastPost(receiverApp);
        const postId = borPostId;

        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        // * Verify message is revealed
        await expect(borPost.body).toContainText(message);

        // * Wait for timer chip to appear (WebSocket update)
        await expect(borPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});

        // # Click timer chip to manually burn
        await borPost.burnOnReadTimerButton.click();

        // * Verify confirmation modal appears
        await expect(receiverApp.burnOnReadConfirmationModal.confirmButton).toBeVisible();

        // # Confirm deletion
        await receiverApp.burnOnReadConfirmationModal.confirmButton.click();

        // * Verify post is removed from receiver's view
        const deletedPostLocator = receiverApp.center.postList.post({id: postId}).locator;
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
            const senderApp = await openDm(pw, sender, team, receiver);

            await senderApp.center.postCreate.burnOnReadButton.click();
            await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
            const message = `Test message ${pw.random.id()}`;
            await sendMessage(senderApp, message);

            // # Login as receiver
            const receiverApp = await openDm(pw, receiver, team, sender);

            // # Reveal the message
            const {post: borPost} = await lastPost(receiverApp);
            await borPost.revealButton.click();
            await expect(borPost.revealButton).not.toBeVisible();

            // * Wait for timer chip to be visible
            await expect(borPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});

            // # Click timer to burn
            await borPost.burnOnReadTimerButton.click();

            // * Verify confirmation modal appears
            await expect(receiverApp.burnOnReadConfirmationModal.confirmButton).toBeVisible();

            // * Verify "don't show again" checkbox is available
            await expect(receiverApp.burnOnReadConfirmationModal.dontShowAgainCheckbox).toBeVisible();

            // # Check "don't show again" and confirm (combined action)
            await receiverApp.burnOnReadConfirmationModal.dontShowAgainCheckbox.check();
            await expect(receiverApp.burnOnReadConfirmationModal.dontShowAgainCheckbox).toBeChecked();
            await receiverApp.burnOnReadConfirmationModal.confirmButton.click();

            // * Verify post is deleted
            await expect(borPost).not.toBeVisible();
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
        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `Timer test ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        // # Login as receiver
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Get the BoR post and reveal it
        const {post: borPost} = await lastPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        // * Verify timer chip is visible (wait for WebSocket update)
        await expect(borPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});

        // * Get initial time
        const initialTime = (await borPost.burnOnReadTimerButton.locator.textContent()) ?? '';

        // * Verify time format is correct (MM:SS or M:SS)
        expect(initialTime).toMatch(/^\d+:\d{2}$/);

        // * Verify the time goes down while staying in the same format
        await expect
            .poll(async () => parseTimeRemaining((await borPost.burnOnReadTimerButton.locator.textContent()) ?? ''))
            .toBeLessThan(parseTimeRemaining(initialTime));
        await expect(borPost.burnOnReadTimerButton).toHaveText(/^\d+:\d{2}$/);
    });

    test('MM-66742_13 message auto-deletes after timer expires', {tag: [BOR_TAG]}, async ({pw}, testInfo) => {
        testInfo.setTimeout(duration.two_min);
        // # Initialize setup with very short duration (10 seconds)
        const {
            user: sender,
            team,
            adminClient,
        } = await setupBorTest(pw, {
            durationSeconds: 10,
            maxTTLSeconds: 86400,
        });

        // # Verify the config was applied before proceeding (guard against state pollution)
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.BurnOnReadDurationSeconds === 10;
        });

        // # Create receiver
        const receiver = await createSecondUser(pw, adminClient, team);

        // # Create DM for controlled environment
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        // # Login as sender and post BoR message
        const senderApp = await openDm(pw, sender, team, receiver);
        // Re-apply guard: concurrent initSetup() may reset BurnOnReadDurationSeconds to 60
        // (default) after the pw.waitUntil check above but before the message is posted.
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 10,
                BurnOnReadMaximumTimeToLiveSeconds: 86400,
            },
        });
        // Confirm the re-apply actually took effect before the post is created.
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.BurnOnReadDurationSeconds === 10;
        });
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `Auto-delete test ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        // # Login as receiver
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Get the BoR post and reveal it
        const {id: borPostId, post: borPost} = await lastPost(receiverApp);
        const postId = borPostId;

        // Re-apply guard: TTL is assigned by the server at reveal time, not post time.
        // A concurrent initSetup() may have reset BurnOnReadDurationSeconds to its
        // default (60 s) between the sender's post and the receiver's reveal click.
        // Re-applying here ensures the server uses 10 s when it writes the TTL.
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableBurnOnRead: true,
                BurnOnReadDurationSeconds: 10,
                BurnOnReadMaximumTimeToLiveSeconds: 86400,
            },
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.ServiceSettings.BurnOnReadDurationSeconds === 10;
        });
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        // * Verify message is visible and timer is running (wait for WebSocket update)
        await expect(borPost.body).toContainText(message);
        await expect(borPost.burnOnReadTimerButton).toBeVisible({timeout: duration.half_min});

        // # Wait for timer to expire (10 seconds + buffer)
        // Use polling to check for post removal
        await expect(async () => {
            const postLocator = receiverApp.center.postList.post({id: postId}).locator;
            await expect(postLocator).not.toBeVisible();
        }).toPass({
            timeout: duration.half_min,
            intervals: [1000],
        });

        // * Verify message is no longer visible
        const deletedPostLocator = receiverApp.center.postList.post({id: postId}).locator;
        await expect(deletedPostLocator).not.toBeVisible();

        // * Verify message text is not in the channel
        const pageContent = await receiverApp.center.postList.locator.textContent();
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
        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `Badge test ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        // # Login as receiver
        const receiverApp = await openDm(pw, receiver, team, sender);

        // # Get the BoR post (still concealed)
        const {post: borPost} = await lastPost(receiverApp);

        // * Verify concealed placeholder is visible
        await expect(borPost.revealButton).toBeVisible();

        // * Verify flame badge is also visible on concealed post
        await expect(borPost.burnOnReadButton).toBeVisible();

        // * Verify badge tooltip shows appropriate message for receiver
        const ariaLabel = (await borPost.burnOnReadButton.locator.getAttribute('aria-label')) ?? '';
        expect(ariaLabel).toContain('Burn-on-read message');
    });
});
