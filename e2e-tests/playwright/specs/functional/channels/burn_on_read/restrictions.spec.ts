// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, openChannel, test, DefaultChannel} from '@mattermost/playwright-lib';

import {
    BOR_TAG,
    concealedPost,
    createSecondUser,
    lastPost,
    openDotMenu,
    openDm,
    sendMessage,
    setupBorTest,
} from './support';

test.describe('Burn-on-Read Restrictions', () => {
    test('MM-66742_19 no reply option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `No reply test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        // # Open dot menu via page object
        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Reply option is NOT present
        await expect(dotMenu.replyMenuItem).not.toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_20 no pin option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `No pin test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Pin option is NOT present
        await expect(dotMenu.pinMenuItem).not.toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_21 no edit option in dot menu for BoR post (sender)', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `No edit test ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        const {post: borPost} = await lastPost(senderApp);

        const dotMenu = await openDotMenu(senderApp, borPost);

        // * Verify Edit option is NOT present (even for sender)
        await expect(dotMenu.editMenuItem).not.toBeVisible();

        await senderApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_22 no forward option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `No forward test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Forward option is NOT present
        await expect(dotMenu.forwardMenuItem).not.toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_23 no copy text option in dot menu for BoR post (receiver)', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `No copy test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Copy Text option is NOT present for receiver
        await expect(dotMenu.copyTextMenuItem).not.toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_24 no copy link option for receiver of BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `No copy link test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Copy Link option is NOT present for receiver
        await expect(dotMenu.copyLinkMenuItem).not.toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_25 sender can copy link to own BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `Sender copy link test ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        const {post: borPost} = await lastPost(senderApp);

        const dotMenu = await openDotMenu(senderApp, borPost);

        // * Verify Copy Link option IS present for sender
        await expect(dotMenu.copyLinkMenuItem).toBeVisible();

        await senderApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_26 no follow thread option for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `No follow test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Follow Thread option is NOT present
        await expect(dotMenu.followThreadMenuItem).not.toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    test('MM-66742_27 keyboard shortcut Shift+UP does not open reply for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        const message = `Keyboard test ${pw.random.id()}`;
        await sendMessage(senderApp, message);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {id: borPostId, post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        // # Focus on the message input box and press Shift+UP
        await receiverApp.center.postCreate.message.container.focus();
        await receiverApp.page.keyboard.press('Shift+ArrowUp');

        // * Verify RHS does not open with the BoR message
        await expect(receiverApp.rhs.thread.post({id: borPostId}).locator).not.toBeVisible();
    });

    test('MM-66742_28 delete option available for revealed BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const senderApp = await openDm(pw, sender, team, receiver);
        await senderApp.center.postCreate.burnOnReadButton.click();
        await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
        await sendMessage(senderApp, `Delete test ${pw.random.id()}`);

        const receiverApp = await openDm(pw, receiver, team, sender);

        const {post: borPost} = await concealedPost(receiverApp);
        await borPost.revealButton.click();
        await expect(borPost.revealButton).not.toBeVisible();

        const dotMenu = await openDotMenu(receiverApp, borPost);

        // * Verify Delete option IS present
        await expect(dotMenu.deleteMenuItem).toBeVisible();

        await receiverApp.page.keyboard.press('Escape');
        await expect(dotMenu.container).not.toBeVisible();
    });

    /**
     * @objective Verify a burn-on-read message cannot be scheduled to repeat weekly.
     *
     * @precondition
     * A test server with valid license and the RecurringScheduledPosts feature flag enabled
     */
    test(
        'withholds weekly recurrence from a burn-on-read draft while offering it for a plain draft',
        {tag: '@burn_on_read'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('RecurringScheduledPosts', true);

            const {user, team} = await setupBorTest(pw);

            const app = await openChannel(pw, user, {team, channel: DefaultChannel.TownSquare});

            /** Opens the custom schedule time dialog from the send button's schedule menu. */
            const openScheduleModal = async () => {
                await app.center.postCreate.sendOptions.openMenuButton.click();
                await expect(app.sendPostOptions.menu.customTimeMenuItem).toBeVisible();
                return app.sendPostOptions.menu.customTimeMenuItem.clickTo(app.dateTimePickerModal);
            };

            // # Draft a plain message and open the custom schedule time modal
            const plainDraft = `Plain draft ${pw.random.id()}`;
            await app.center.postCreate.message.container.fill(plainDraft);
            await expect(app.center.postCreate.message.container).toHaveValue(plainDraft);
            const plainDraftModal = await openScheduleModal();

            // * Verify recurrence is offered here, so the assertion below cannot pass merely
            // * because the flag was off or the modal never rendered
            await expect(plainDraftModal.repeatWeeklyCheckbox).toBeEnabled();

            // # Discard the modal and turn the same draft into a burn-on-read message
            await plainDraftModal.closeButton.click();
            await expect(plainDraftModal.repeatWeeklyCheckbox).not.toBeVisible();
            await app.center.postCreate.burnOnReadButton.click();
            await expect(app.center.postCreate.burnOnReadLabel).toBeVisible();

            // # Reopen the custom schedule time modal
            const burnOnReadModal = await openScheduleModal();

            // * Verify recurrence is withheld now that the draft is burn-on-read
            await expect(burnOnReadModal.repeatWeeklyCheckbox).toBeDisabled();
        },
    );
});
