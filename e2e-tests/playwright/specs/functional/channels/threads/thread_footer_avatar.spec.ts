// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, PlaywrightClient4, testConfig} from '@mattermost/playwright-lib';

/**
 * @objective Verify that thread footer avatars with a broken image URL still render at correct
 * square dimensions — i.e. width equals height — confirming that alt text does not distort
 * the element when the image fails to load.
 */
test('MM-69802 Thread footer avatar with broken image URL renders with equal width and height', async ({pw}) => {
    // adminClient.createPost always posts as sysadmin regardless of user_id,
    // so we need a dedicated client per user to get distinct thread participants.
    const {adminClient, team, user, userClient} = await pw.initSetup();

    const [otherUser1, otherUser2] = await adminClient.createUsers(team.id, 2, 'thread-avatar');

    const makeUserClient = async (u: typeof otherUser1) => {
        const c = new PlaywrightClient4();
        c.setUrl(testConfig.baseURL);
        await c.login(u.username, (u as any).password);
        return c;
    };
    const [otherUserClient1, otherUserClient2] = await Promise.all([
        makeUserClient(otherUser1),
        makeUserClient(otherUser2),
    ]);

    // Set up a channel with all users and a threaded exchange
    const channel = await adminClient.createPublicChannel(team.id, 'thread-avatar-test');
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.addToChannel(otherUser1.id, channel.id);
    await adminClient.addToChannel(otherUser2.id, channel.id);

    const root = await userClient.createPost({channel_id: channel.id, message: 'Root post'});
    await otherUserClient1.createPost({channel_id: channel.id, message: 'Reply', root_id: root.id});
    await otherUserClient2.createPost({channel_id: channel.id, message: 'Reply', root_id: root.id});

    const {app, page} = await pw.testBrowser.login(user);

    // # Intercept all user profile picture requests (both the versioned URL and the /default
    // fallback) so the browser is forced to render alt text — the state the CSS fix addresses.
    await page.route(/\/api\/v4\/users\/[^/]*\/image/, (route) => route.fulfill({status: 404}));

    await app.channelsPage.goto({team, channel});

    // * The root post's thread footer shows one avatar per replying participant
    const participants = app.center.postList.post(root).threadFooter.participants;
    await expect(participants.avatarList).toHaveKeyCount(2);

    // * Verify each avatar has equal width and height
    for (const position of await participants.avatarList.keys()) {
        const box = await participants.avatar(position).locator.boundingBox();
        expect(box?.width).toBe(box?.height);
        expect(box?.width).toBeGreaterThan(0);
    }
});
