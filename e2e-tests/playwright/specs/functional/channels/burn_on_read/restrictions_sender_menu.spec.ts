// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM, loginAndPostBorDM, openPostDotMenu} from './support';

test.describe('Burn-on-Read Restrictions', () => {
    test('MM-66742_21 no edit option in dot menu for BoR post (sender)', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        const {channelsPage: senderPage} = await loginAndPostBorDM(
            pw,
            sender,
            receiver,
            team,
            `No edit test ${pw.random.id()}`,
        );

        const borPost = await senderPage.getLastPost();

        await openPostDotMenu(borPost);

        // * Verify Edit option is NOT present (even for sender)
        await expect(senderPage.postDotMenu.editMenuItem).not.toBeVisible();

        await senderPage.page.keyboard.press('Escape');
    });

    test('MM-66742_25 sender can copy link to own BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        const {channelsPage: senderPage} = await loginAndPostBorDM(
            pw,
            sender,
            receiver,
            team,
            `Sender copy link test ${pw.random.id()}`,
        );

        const borPost = await senderPage.getLastPost();

        await openPostDotMenu(borPost);

        // * Verify Copy Link option IS present for sender
        await expect(senderPage.postDotMenu.copyLinkMenuItem).toBeVisible();

        await senderPage.page.keyboard.press('Escape');
    });
});
