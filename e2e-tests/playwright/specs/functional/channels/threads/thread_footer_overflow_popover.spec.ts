// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, PlaywrightClient4, testConfig} from '@mattermost/playwright-lib';

// Enough distinct repliers that Avatars caps the stack at three and renders a "+N"
// chip. The thread footer opts in via showOverflowPopover, so that chip is clickable.
const REPLIER_COUNT = 6;

/**
 * @objective Verify the thread footer's "+N" overflow chip opens a list of the overflow
 * participants, and that a row in that list opens the participant's profile popover.
 */
test('Thread footer overflow chip opens a list of the remaining participants', async ({pw}) => {
    // adminClient.createPost always posts as sysadmin regardless of user_id,
    // so we need a dedicated client per user to get distinct thread participants.
    const {adminClient, team, user, userClient} = await pw.initSetup();

    const repliers = await adminClient.createUsers(team.id, REPLIER_COUNT, 'thread-overflow');

    const makeUserClient = async (u: (typeof repliers)[number]) => {
        const c = new PlaywrightClient4();
        c.setUrl(testConfig.baseURL);
        await c.login(u.username, (u as any).password);
        return c;
    };
    const replierClients = await Promise.all(repliers.map(makeUserClient));

    // # Set up a channel containing every participant
    const channel = await adminClient.createPublicChannel(team.id, 'thread-overflow-test');
    await adminClient.addToChannel(user.id, channel.id);
    await Promise.all(repliers.map((r) => adminClient.addToChannel(r.id, channel.id)));

    // # Build a thread each seeded user has replied to
    const root = await userClient.createPost({channel_id: channel.id, message: 'Root post'});
    for (const client of replierClients) {
        // Serial: replies posted concurrently can collide on thread participant ordering.
        await client.createPost({channel_id: channel.id, message: 'Reply', root_id: root.id});
    }

    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const rootPost = await channelsPage.centerView.getPostById(root.id);
    await rootPost.toBeVisible();

    const {threadFooter} = rootPost;
    await threadFooter.toBeVisible();

    // * The stack is capped and an overflow chip is rendered
    await expect(threadFooter.overflowChip).toBeVisible();

    // # Open the overflow list
    await threadFooter.openOverflow();

    // * It lists the participants the stack could not show
    const rows = threadFooter.overflowPopover.getByRole('listitem');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // # Open a participant's profile from the list
    await rows.first().getByRole('button').first().click();

    // * The profile popover opens over the list
    await expect(threadFooter.overflowPopover.page().getByTestId('user-profile-popover')).toBeVisible();
});

/**
 * @objective Verify the overflow list is dismissible from the keyboard.
 */
test('Thread footer overflow list closes on Escape', async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();

    const repliers = await adminClient.createUsers(team.id, REPLIER_COUNT, 'thread-overflow-esc');

    const replierClients = await Promise.all(
        repliers.map(async (u) => {
            const c = new PlaywrightClient4();
            c.setUrl(testConfig.baseURL);
            await c.login(u.username, (u as any).password);
            return c;
        }),
    );

    const channel = await adminClient.createPublicChannel(team.id, 'thread-overflow-esc-test');
    await adminClient.addToChannel(user.id, channel.id);
    await Promise.all(repliers.map((r) => adminClient.addToChannel(r.id, channel.id)));

    const root = await userClient.createPost({channel_id: channel.id, message: 'Root post'});
    for (const client of replierClients) {
        await client.createPost({channel_id: channel.id, message: 'Reply', root_id: root.id});
    }

    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const rootPost = await channelsPage.centerView.getPostById(root.id);
    await rootPost.toBeVisible();

    const {threadFooter} = rootPost;
    await threadFooter.toBeVisible();

    // # Open the overflow list
    await threadFooter.openOverflow();

    // # Dismiss it
    await page.keyboard.press('Escape');

    // * It closes
    await expect(threadFooter.overflowPopover).not.toBeVisible();
});
