// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, ignoreMissing, test, getAdminClient} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

// Teams created by pw.initSetup() in each test are tracked here and deleted in
// afterEach so local environments don't accumulate stale teams across runs.
const createdTeamIds: string[] = [];

async function initSetupTracked(pw: PlaywrightExtended) {
    const setup = await pw.initSetup();
    createdTeamIds.push(setup.team.id);
    return setup;
}

test.afterEach(async () => {
    if (createdTeamIds.length === 0) {
        return;
    }
    const ids = createdTeamIds.splice(0);
    const {adminClient} = await getAdminClient({skipLog: true});
    await Promise.all(ids.map((id) => ignoreMissing(() => adminClient.deleteTeam(id))));
});

test(
    'sidebar icon updates from globe to lock when channel converted to private via API',
    {tag: ['@channels', '@channel_privacy']},
    async ({pw}) => {
        // # Initialize setup
        const {adminClient, user, team} = await initSetupTracked(pw);

        // # Create a public channel
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'privacy-ws-test',
                displayName: 'Privacy WS Test',
                type: 'O',
                unique: true,
            }),
        );
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in user and navigate to the channel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        // * Verify sidebar shows the globe icon (public channel)
        const sidebarItem = app.lhs.channelList.channel(channel);
        await expect(sidebarItem.publicIcon).toBeVisible();
        await expect(sidebarItem.privateIcon).not.toBeVisible();

        // # Convert channel to private via admin API (simulates mmctl)
        await adminClient.updateChannelPrivacy(channel.id, 'P');

        // * Verify sidebar icon updates to the lock without page refresh
        await expect(sidebarItem.privateIcon).toBeVisible();
        await expect(sidebarItem.publicIcon).not.toBeVisible();
    },
);

test(
    'sidebar icon updates from lock to globe when channel converted to public via API',
    {tag: ['@channels', '@channel_privacy']},
    async ({pw}) => {
        // # Initialize setup
        const {adminClient, user, team} = await initSetupTracked(pw);

        // # Create a private channel
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                name: 'privacy-ws-test-p2o',
                displayName: 'Privacy WS Test P2O',
                type: 'P',
                unique: true,
            }),
        );
        await adminClient.addToChannel(user.id, channel.id);

        // # Log in user and navigate to the channel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        // * Verify sidebar shows the lock icon (private channel)
        const sidebarItem = app.lhs.channelList.channel(channel);
        await expect(sidebarItem.privateIcon).toBeVisible();
        await expect(sidebarItem.publicIcon).not.toBeVisible();

        // # Convert channel to public via admin API (simulates mmctl)
        await adminClient.updateChannelPrivacy(channel.id, 'O');

        // * Verify sidebar icon updates to the globe without page refresh
        await expect(sidebarItem.publicIcon).toBeVisible();
        await expect(sidebarItem.privateIcon).not.toBeVisible();
    },
);
