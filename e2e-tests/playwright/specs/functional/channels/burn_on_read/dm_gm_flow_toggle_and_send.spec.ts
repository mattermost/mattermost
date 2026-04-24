// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM} from './support';

test.describe('Burn-on-Read in DMs and GMs', () => {
    test('MM-66742_1 BoR toggle is available in DM channel', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and otherUser
        const {sender: user, receiver: otherUser, team} = await setupBorDM(pw);

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
    });

    test('MM-66742_2 complete BoR flow in DM between two users', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and navigate to DM
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name);
        await senderPage.toBeVisible();
        await senderPage.goto(team.name, `@${receiver.username}`);

        // # Enable BoR and send message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const secretMessage = `DM secret ${pw.random.id()}`;
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
    });

    test('MM-66742_8 BoR toggle resets after sending message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

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
        const message1 = `BoR message ${pw.random.id()}`;
        await senderPage.postMessage(message1);

        // * Verify BoR is disabled after sending (toggle resets)
        const isEnabledAfter = await senderPage.centerView.postCreate.isBurnOnReadEnabled();
        expect(isEnabledAfter).toBe(false);

        // * Verify the sent message has BoR badge (was sent as BoR)
        const lastPost = await senderPage.getLastPost();
        await expect(lastPost.burnOnReadBadge.container).toBeVisible();
    });
});
