// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM} from './support';

test.describe('Burn-on-Read Receiver Flow', () => {
    test('MM-66742_9 receiver sees concealed placeholder and reveals message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and navigate to DM
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();

        // # Post BoR message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const secretMessage = `Secret message ${pw.random.id()}`;
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

    test('MM-66742_14 receiver sees flame badge on concealed message', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and post BoR message
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name);
        await senderPage.toBeVisible();
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Badge test ${pw.random.id()}`;
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
