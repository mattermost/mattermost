// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAsset} from '@/asset';
import {Api, test, expect, requireSubpathServer, settle} from '@mattermost/playwright-lib';

test.describe('Subpath - file upload', {tag: '@subpath'}, () => {
    test.beforeAll(() => {
        requireSubpathServer();
    });

    /**
     * @objective Verify a file attachment uploads and previews correctly under the subpath.
     */
    test('uploads and previews a file attachment under the subpath', async ({pw}) => {
        const {user, team, townSquare} = await pw.initSetup();

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        const {postCreate, postList} = app.center;

        // # Post a message with an image attachment
        await settle(postCreate.uploadInput, {wait: Api.UploadFile}).chooseFiles(getAsset('small-image.png'));
        await expect(postCreate.filePreviews.fileList).toHaveKeyCount(1);
        await postCreate.message.container.fill(`Subpath file upload ${pw.random.id()}`);
        const sent = await settle(postCreate.sendButton, {wait: Api.CreatePost}).click();

        // * Verify the attachment thumbnail loads
        const thumbnail = postList.post(sent).attachments.image({id: sent.file_ids![0]}).picture;
        await expect(thumbnail.container).toBeVisible();
        await expect(thumbnail.container).toHaveAccessibleName(/file thumbnail/i);
    });
});
