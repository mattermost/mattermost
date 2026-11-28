// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, duration, expect, setupFileServer, settle, test} from '@mattermost/playwright-lib';

import {BOR_TAG, concealedPost, createSecondUser, openDm, reveal, setupBorTest} from './support';

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
    const senderApp = await openDm(pw, sender, team, receiver);
    await senderApp.center.postCreate.burnOnReadButton.click();
    await expect(senderApp.center.postCreate.burnOnReadLabel).toBeVisible();
    await senderApp.center.postCreate.message.container.fill(message);
    const sent = await settle(senderApp.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    const postId = sent.id;
    const senderPost = senderApp.center.postList.post({id: postId});
    const senderPreview = senderPost.linkPreview.container;

    // * Verify the link preview is shown to the sender
    await expect(senderPreview).toBeVisible({timeout: duration.half_min});

    // # Log in as the receiver and reveal the message
    const revealApp = await openDm(pw, receiver, team, sender);
    const {post: revealPost} = await concealedPost(revealApp);
    await reveal(revealPost);

    // # Open the conversation as the receiver in a new session, since previews are not rendered on reveal
    const receiverApp = await openDm(pw, receiver, team, sender);
    const receiverPost = receiverApp.center.postList.post({id: postId});
    const receiverPreview = receiverPost.linkPreview.container;

    // * Verify the receiver also sees the link preview
    await expect(receiverPreview).toBeVisible({timeout: duration.half_min});

    // # Remove the link preview as the sender
    await senderPreview.hover();
    await senderPost.linkPreview.removeButton.click();
    await expect(senderPreview).not.toBeVisible();

    // # Reload as the sender
    await senderApp.page.reload();
    await expect(senderApp.center.postCreate).toBeVisible();

    // * Verify the message is still shown without its preview
    await expect(senderPost.message.container).toContainText(message);
    await expect(senderPreview).not.toBeVisible();

    // # Reload as the receiver
    await receiverApp.page.reload();
    await expect(receiverApp.center.postCreate).toBeVisible();

    // * Verify the receiver sees the message without the link preview
    await expect(receiverPost.message.container).toContainText(message);
    await expect(receiverPreview).not.toBeVisible();
});
