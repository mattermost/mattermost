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
        const {user, team, adminClient} = await pw.initSetup();
        const [otherUser] = await adminClient.createUsers(team.id, 1, 'subpathws');

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        const message = `Subpath realtime message ${pw.random.id()}`;

        // # Another user posts to the same channel via API
        const {client: otherUserClient} = await pw.makeClient(otherUser);
        await otherUserClient.createPost({channel_id: townSquare.id, message});

        // * Verify the message appears live, without a page reload
        await expect(channelsPage.centerView.container.getByText(message, {exact: true})).toBeVisible({
            timeout: pw.duration.ten_sec,
        });
    });
});
