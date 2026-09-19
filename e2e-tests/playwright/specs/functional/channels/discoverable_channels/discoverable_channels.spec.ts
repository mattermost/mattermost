// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * These specs cover the Discoverable Private Channels request-to-join UX
 * (MM-68764). They only run when the DiscoverableChannels feature flag is
 * enabled on the server (e.g. MM_FEATUREFLAGS_DiscoverableChannels=true);
 * otherwise they self-skip.
 */

async function createDiscoverableChannel(adminClient: any, teamId: string) {
    const suffix = Date.now();
    return adminClient.createChannel({
        team_id: teamId,
        name: `disc-private-${suffix}`,
        display_name: `Discoverable Private ${suffix}`,
        type: 'P',
        discoverable: true,
    });
}

test(
    'MM-68764 non-member requests to join a discoverable private channel from Browse Channels and can withdraw',
    {tag: ['@discoverable_channels']},
    async ({pw}) => {
        await pw.skipIfFeatureFlagNotSet('DiscoverableChannels', true);

        // # Initialize setup and create a discoverable private channel the user is not a member of
        const {team, user, adminClient} = await pw.initSetup();
        const channel = await createDiscoverableChannel(adminClient, team.id);

        // # Log in as the non-member user and open Browse Channels
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const dialog = await channelsPage.openBrowseChannelsModal();
        await dialog.toBeVisible();

        // # Find the discoverable channel
        await dialog.fillSearchInput(channel.display_name);
        await dialog.toBeDoneLoading();

        // * The row offers "Request to join" rather than a Join button
        await dialog.toHaveRequestToJoinButton(channel.display_name);

        // # Request to join and confirm in the modal
        await dialog.clickRequestToJoin(channel.display_name);
        await expect(channelsPage.page.getByRole('button', {name: 'Send Request'})).toBeVisible();
        await channelsPage.page.getByRole('button', {name: 'Send Request'}).click();

        // * The row flips to the pending "Withdraw" state
        await dialog.toHaveWithdrawButton(channel.display_name);

        // # Withdraw the request
        await dialog.clickWithdraw(channel.display_name);

        // * The row returns to the "Request to join" state
        await dialog.toHaveRequestToJoinButton(channel.display_name);
    },
);

test(
    'MM-68764 selecting a discoverable private channel from Find Channels opens Request to Join, not the legacy join',
    {tag: ['@discoverable_channels']},
    async ({pw}) => {
        await pw.skipIfFeatureFlagNotSet('DiscoverableChannels', true);

        // # Initialize setup and create a discoverable private channel the user is not a member of
        const {team, user, adminClient} = await pw.initSetup();
        const channel = await createDiscoverableChannel(adminClient, team.id);

        // # Log in as the non-member user
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Find Channels (Cmd/Ctrl+K) and locate the discoverable channel
        await channelsPage.sidebarLeft.findChannelButton.click();
        await channelsPage.findChannelsModal.toBeVisible();
        await channelsPage.findChannelsModal.input.fill(channel.display_name);

        const result = channelsPage.findChannelsModal.getResult(channel.name);
        await expect(result).toBeVisible();

        // # Select the discoverable channel
        await channelsPage.findChannelsModal.selectChannel(channel.name);

        // * The Request to Join modal opens instead of the legacy private-channel join
        // confirmation, and no "Join private channel" dialog is shown.
        await expect(channelsPage.page.getByRole('button', {name: 'Send Request'})).toBeVisible();
        await expect(channelsPage.page.getByText('Are you sure you wish to join')).toHaveCount(0);
    },
);
