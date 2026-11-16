// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setupFileServer, test} from '@mattermost/playwright-lib';

import {BOR_TAG, createSecondUser, setupBorTest} from './support';

let fileServerUrl: string;
setupFileServer().then((serverUrl) => {
    fileServerUrl = serverUrl;
});

/**
 * @objective Verify the sender can remove the link preview of a Burn-on-Read message, and the receiver does not see it after revealing.
 */
test('MM-67309 sender removes the link preview from a Burn-on-Read message', {tag: [BOR_TAG]}, async ({pw}) => {
    const {user: sender, team, adminClient} = await setupBorTest(pw, {durationSeconds: 600, maxTTLSeconds: 600});
    const receiver = await createSecondUser(pw, adminClient, team);

    await adminClient.patchConfig({
        ServiceSettings: {
            EnableLinkPreviews: true,
            AllowedUntrustedInternalConnections: new URL(fileServerUrl).hostname,
        },
    });
    await Promise.all(
        [sender, receiver].map((u) =>
            adminClient.savePreferences(u.id, [
                {user_id: u.id, category: 'display_settings', name: 'link_previews', value: 'true'},
                {user_id: u.id, category: 'display_settings', name: 'collapse_previews', value: 'false'},
            ]),
        ),
    );
    await adminClient.createDirectChannel([sender.id, receiver.id]);
    const message = `${fileServerUrl}/opengraph-huge.html`;

    // # Log in as the sender and post a Burn-on-Read message with a link
    const {channelsPage: senderPage, page: senderBrowserPage} = await pw.testBrowser.login(sender);
    await senderPage.goto(team.name, `@${receiver.username}`);
    await senderPage.toBeVisible();
    await senderPage.centerView.postCreate.toggleBurnOnRead();
    const postResponsePromise = senderBrowserPage.waitForResponse(
        (response) => response.url().endsWith('/api/v4/posts') && response.request().method() === 'POST',
    );
    await senderPage.postMessage(message);
    const postId = ((await (await postResponsePromise).json()) as {id: string}).id;
    const senderPost = await senderPage.centerView.getPostById(postId);
    const senderPreview = senderPost.getLinkPreview();

    // * Verify the link preview is shown to the sender
    await senderPreview.toBeVisible(pw.duration.half_min);

    // # Log in as the receiver and reveal the message
    const {channelsPage: revealPage} = await pw.testBrowser.login(receiver);
    await revealPage.goto(team.name, `@${sender.username}`);
    await revealPage.toBeVisible();
    const revealPost = await revealPage.centerView.getPostById(postId);
    await revealPost.concealedPlaceholder.clickToReveal();
    await revealPost.concealedPlaceholder.waitForReveal();

    // # Open the conversation as the receiver in a new session, since previews are not rendered on reveal
    const {channelsPage: receiverPage, page: receiverBrowserPage} = await pw.testBrowser.login(receiver);
    await receiverPage.goto(team.name, `@${sender.username}`);
    await receiverPage.toBeVisible();
    const receiverPost = await receiverPage.centerView.getPostById(postId);
    const receiverPreview = receiverPost.getLinkPreview();

    // * Verify the receiver also sees the link preview
    await receiverPreview.toBeVisible(pw.duration.half_min);

    // # Remove the link preview as the sender
    await senderPreview.remove();

    // # Reload as the sender
    await senderBrowserPage.reload();
    await senderPage.toBeVisible();

    // * Verify the message is still shown without its preview
    await expect(senderPost.body).toContainText(message);
    await senderPreview.toNotBeVisible();

    // # Reload as the receiver
    await receiverBrowserPage.reload();
    await receiverPage.toBeVisible();

    // * Verify the receiver sees the message without the link preview
    await expect(receiverPost.body).toContainText(message);
    await receiverPreview.toNotBeVisible();
});
