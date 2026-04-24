// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM, loginAndPostBorDM, loginReceiverOpenDM, revealBorPost, openPostDotMenu} from './support';

test.describe('Burn-on-Read Restrictions', () => {
    test('MM-66742_23 no copy text option in dot menu for BoR post (receiver)', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `No copy test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        await openPostDotMenu(borPost);

        // * Verify Copy Text option is NOT present for receiver
        await expect(receiverPage.postDotMenu.copyTextMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_24 no copy link option for receiver of BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `No copy link test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        await openPostDotMenu(borPost);

        // * Verify Copy Link option is NOT present for receiver
        await expect(receiverPage.postDotMenu.copyLinkMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_26 no follow thread option for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `No follow test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        await openPostDotMenu(borPost);

        // * Verify Follow Thread option is NOT present
        await expect(receiverPage.postDotMenu.followMessageMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });
});
