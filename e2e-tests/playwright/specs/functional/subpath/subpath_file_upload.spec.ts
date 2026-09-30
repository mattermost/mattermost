// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - file upload', {tag: '@subpath'}, () => {
    test.beforeAll(() => {
        requireSubpathServer();
    });

    /**
     * @objective Verify a file attachment uploads and previews correctly under the subpath.
     */
    test('uploads and previews a file attachment under the subpath', async ({pw}) => {
        const {user, team} = await pw.initSetup();

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post a message with an image attachment
        await channelsPage.postMessage(`Subpath file upload ${pw.random.id()}`, ['small-image.png']);

        // * Verify the attachment thumbnail loads
        const post = await channelsPage.getLastPost();
        await expect(post.container.getByLabel(/file thumbnail/i)).toBeVisible();
    });
});
