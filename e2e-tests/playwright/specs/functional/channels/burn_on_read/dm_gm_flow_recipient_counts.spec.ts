// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, setupBorDM, createSecondUser, createPrivateChannelWithMembers} from './support';

test.describe('Burn-on-Read in DMs and GMs', () => {
    test(
        'MM-66742_3 BoR message in group message with multiple recipients',
        {tag: [BOR_TAG]},
        async ({pw}, testInfo) => {
            testInfo.setTimeout(120000);
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create two other users for the group
            const recipient1 = await createSecondUser(pw, adminClient, team);
            const recipient2 = await createSecondUser(pw, adminClient, team);

            // # Create a private channel with exactly 3 members (sender + 2 recipients)
            // This gives us control over the exact member count
            const channel = await createPrivateChannelWithMembers(
                pw,
                adminClient,
                team,
                [sender.id, recipient1.id, recipient2.id],
                {name: 'bor-gm-test', displayName: 'BoR GM Test'},
            );

            // # Login as sender and navigate to the channel
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, channel.name);
            await senderPage.toBeVisible();

            // # Enable BoR and send message
            await senderPage.centerView.postCreate.toggleBurnOnRead();
            const secretMessage = `GM secret ${pw.random.id()}`;
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

    test('MM-66742_6 DM shows correct recipient count of 1', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled + DM between sender and receiver
        const {sender, receiver, team} = await setupBorDM(pw);

        // # Login as sender and navigate to DM
        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name);
        await senderPage.toBeVisible();
        await senderPage.goto(team.name, `@${receiver.username}`);

        // # Enable BoR and send message
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const secretMessage = `Count test ${pw.random.id()}`;
        await senderPage.postMessage(secretMessage);

        // # Get sender's view
        const senderPost = await senderPage.getLastPost();

        // * Verify tooltip shows exactly 1 recipient
        await senderPost.burnOnReadBadge.hover();
        const recipientCount = await senderPost.burnOnReadBadge.getRecipientCount();
        expect(recipientCount.total).toBe(1);
        expect(recipientCount.revealed).toBe(0);
    });
});
