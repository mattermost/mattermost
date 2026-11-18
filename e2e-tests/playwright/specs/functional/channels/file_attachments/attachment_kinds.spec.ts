// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a post's images show as gallery tiles, a single image as an image view and a
 * document as a file card, and that a tile opens the image in the preview modal.
 */
test(
    'shows images as gallery tiles, one image as an image view and a document as a file card, and previews a tile',
    {tag: '@file_attachments'},
    async ({pw}) => {
        const {team, user, userClient, townSquare: channel} = await pw.initSetup();
        // # Post two images (a gallery) and a document
        const images = await userClient.createTestPost({channel_id: channel.id, message: 'two images'}, [
            'mattermost.png',
            'small-image.png',
        ]);
        const doc = await userClient.createTestPost({channel_id: channel.id, message: 'a document'}, [
            'sample_text_file.txt',
        ]);
        const single = await userClient.createTestPost({channel_id: channel.id, message: 'one image'}, [
            'mattermost.png',
        ]);

        // # Log in and open the channel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        // * Each image is a tile of the post's attachments, the document a card
        const gallery = app.center.postList.post(images).attachments;
        for (const id of images.file_ids!) {
            await expect(gallery.file({id})).toBeVisible();
        }
        const card = app.center.postList.post(doc).attachments.fileCard({id: doc.file_ids![0]});
        await expect(card).toBeVisible();

        // * A single image is an image view
        await expect(app.center.postList.post(single).attachments.image({id: single.file_ids![0]})).toBeVisible();

        // # Open the first image
        await gallery.file({id: images.file_ids![0]}).click();

        // * The preview modal shows it
        await expect(app.filePreviewModal.imageImg).toBeVisible();
    },
);
