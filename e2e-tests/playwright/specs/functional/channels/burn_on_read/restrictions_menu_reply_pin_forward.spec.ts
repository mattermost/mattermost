// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM, loginAndPostBorDM, loginReceiverOpenDM, revealBorPost, openPostDotMenu} from './support';

test.describe('Burn-on-Read Restrictions', () => {
    test('MM-66742_19 no reply option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `No reply test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        // # Open dot menu via page object
        await openPostDotMenu(borPost);

        // * Verify Reply option is NOT present
        await expect(receiverPage.postDotMenu.replyMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_20 no pin option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `No pin test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        await openPostDotMenu(borPost);

        // * Verify Pin option is NOT present
        await expect(receiverPage.postDotMenu.pinToChannelMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_22 no forward option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `No forward test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        await openPostDotMenu(borPost);

        // * Verify Forward option is NOT present
        await expect(receiverPage.postDotMenu.forwardMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });
});
