// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorDM, loginAndPostBorDM, loginReceiverOpenDM, revealBorPost, openPostDotMenu} from './support';

test.describe('Burn-on-Read Restrictions', () => {
    test('MM-66742_27 keyboard shortcut Shift+UP does not open reply for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        const message = `Keyboard test ${pw.random.id()}`;
        await loginAndPostBorDM(pw, sender, receiver, team, message);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        // # Focus on the message input box and press Shift+UP
        await receiverPage.centerView.postCreate.input.click();
        await receiverPage.page.keyboard.press('Shift+ArrowUp');

        // * Verify RHS does not open with the BoR message
        await expect(receiverPage.sidebarRight.container)
            .toBeHidden({timeout: 2000})
            .catch(async () => {
                await expect(receiverPage.sidebarRight.container).not.toContainText(message);
            });
    });

    test('MM-66742_28 delete option available for revealed BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {sender, receiver, team} = await setupBorDM(pw);
        await loginAndPostBorDM(pw, sender, receiver, team, `Delete test ${pw.random.id()}`);

        const {channelsPage: receiverPage, borPost} = await loginReceiverOpenDM(pw, receiver, sender, team);
        await revealBorPost(borPost);

        await openPostDotMenu(borPost);

        // * Verify Delete option IS present
        await expect(receiverPage.postDotMenu.deleteMenuItem).toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });
});
