// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser, createPrivateChannelWithMembers} from './support';

test.describe('Burn-on-Read Sender Flow', () => {
    test('MM-66742_15 sends BoR message and views sent status with recipient count', {tag: [BOR_TAG]}, async ({pw}) => {
        // # Initialize setup with BoR enabled
        const {user, team, adminClient} = await setupBorTest(pw);

        // # Create second user as recipient (needed for BoR badge count)
        await createSecondUser(pw, adminClient, team);

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
    });

    test('MM-66742_16 sender sees read receipts in tooltip', {tag: [BOR_TAG]}, async ({pw}, testInfo) => {
        testInfo.setTimeout(120000);
        // # Initialize setup with BoR enabled
        const {user, team, adminClient} = await setupBorTest(pw);

        // # Create two recipients
        const recipient1 = await createSecondUser(pw, adminClient, team);
        const recipient2 = await createSecondUser(pw, adminClient, team);

        // # Create a private channel with exactly these 3 users (sender + 2 recipients)
        // This ensures exactly 3 members: sender + 2 recipients (admin auto-added then removed)
        const channel = await createPrivateChannelWithMembers(
            pw,
            adminClient,
            team,
            [user.id, recipient1.id, recipient2.id],
            {name: 'bor-test', displayName: 'BoR Test'},
        );

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
        await expect(senderPost.burnOnReadBadge.container).toBeVisible({timeout: 15000});
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

        // # Refresh sender's view — all recipients revealed, sender timer should start
        await senderPage.page.reload();
        await senderPage.toBeVisible();
        senderPost = await senderPage.getLastPost();

        // * After all recipients reveal, badge transitions to timer chip
        await expect(senderPost.burnOnReadTimerChip.container).toBeVisible({timeout: 15000});
    });
});
