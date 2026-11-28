// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - websocket real-time delivery', {tag: '@subpath'}, () => {
    test.beforeAll(() => {
        requireSubpathServer();
    });

    /**
     * @objective Verify a message posted by another user is delivered live over the proxied
     * websocket connection.
     */
    test('delivers a new message live through the subpath proxy websocket', async ({pw}) => {
        const {user, team, adminClient, townSquare} = await pw.initSetup();
        const [otherUser] = await adminClient.createUsers(team.id, 1, 'subpathws');

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        const message = `Subpath realtime message ${pw.random.id()}`;

        // # Another user posts to the same channel via API
        const {client: otherUserClient} = await pw.makeClient(otherUser);
        const sent = await otherUserClient.createPost({channel_id: townSquare.id, message});

        // * Verify the message appears live, without a page reload
        await expect(app.center.postList.post(sent).message.container).toHaveText(message, {
            timeout: pw.duration.ten_sec,
        });
    });
});
