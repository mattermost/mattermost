// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM} from './support';

test.describe('Burn-on-Read Receiver Flow', () => {
    test('MM-66742_12 timer chip displays countdown after reveal', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with 60 second duration + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw, {
            durationSeconds: 60,
        });

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Timer test ${pw.random.id()}`;
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
        // # Initialize setup with very short duration (10 seconds) + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw, {
            durationSeconds: 10,
            maxTTLSeconds: 300,
        });

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Auto-delete test ${pw.random.id()}`;
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
});
