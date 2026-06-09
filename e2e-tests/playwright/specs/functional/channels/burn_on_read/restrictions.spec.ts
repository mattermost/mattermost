// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser} from './support';

test.describe('Burn-on-Read Restrictions', () => {
    test('MM-66742_19 no reply option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No reply test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        // # Open dot menu via page object
        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Reply option is NOT present
        await expect(receiverPage.postDotMenu.replyMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_20 no pin option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No pin test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Pin option is NOT present
        await expect(receiverPage.postDotMenu.pinToChannelMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_21 no edit option in dot menu for BoR post (sender)', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No edit test ${pw.random.id()}`);

        const borPost = await senderPage.getLastPost();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Edit option is NOT present (even for sender)
        await expect(senderPage.postDotMenu.editMenuItem).not.toBeVisible();

        await senderPage.page.keyboard.press('Escape');
    });

    test('MM-66742_22 no forward option in dot menu for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No forward test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Forward option is NOT present
        await expect(receiverPage.postDotMenu.forwardMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_23 no copy text option in dot menu for BoR post (receiver)', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No copy test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Copy Text option is NOT present for receiver
        await expect(receiverPage.postDotMenu.copyTextMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_24 no copy link option for receiver of BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No copy link test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Copy Link option is NOT present for receiver
        await expect(receiverPage.postDotMenu.copyLinkMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_25 sender can copy link to own BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`Sender copy link test ${pw.random.id()}`);

        const borPost = await senderPage.getLastPost();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Copy Link option IS present for sender
        await expect(senderPage.postDotMenu.copyLinkMenuItem).toBeVisible();

        await senderPage.page.keyboard.press('Escape');
    });

    test('MM-66742_26 no follow thread option for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`No follow test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Follow Thread option is NOT present
        await expect(receiverPage.postDotMenu.followMessageMenuItem).not.toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });

    test('MM-66742_27 keyboard shortcut Shift+UP does not open reply for BoR post', {tag: [BOR_TAG]}, async ({pw}) => {
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        const message = `Keyboard test ${pw.random.id()}`;
        await senderPage.postMessage(message);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

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
        const {user: sender, team, adminClient} = await setupBorTest(pw);
        const receiver = await createSecondUser(pw, adminClient, team);
        await adminClient.createDirectChannel([sender.id, receiver.id]);

        const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
        await senderPage.goto(team.name, `@${receiver.username}`);
        await senderPage.toBeVisible();
        await senderPage.centerView.postCreate.toggleBurnOnRead();
        await senderPage.postMessage(`Delete test ${pw.random.id()}`);

        const {channelsPage: receiverPage} = await pw.testBrowser.login(receiver);
        await receiverPage.goto(team.name, `@${sender.username}`);
        await receiverPage.toBeVisible();

        const borPost = await receiverPage.getLastPost();
        await borPost.concealedPlaceholder.clickToReveal();
        await borPost.concealedPlaceholder.waitForReveal();

        await borPost.hover();
        await borPost.postMenu.openDotMenu();

        // * Verify Delete option IS present
        await expect(receiverPage.postDotMenu.deleteMenuItem).toBeVisible();

        await receiverPage.page.keyboard.press('Escape');
    });
});
