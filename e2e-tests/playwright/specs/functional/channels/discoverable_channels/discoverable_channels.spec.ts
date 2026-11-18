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

/**
 * @knownIssue Browse Channels' search results intermittently omit the "Request to join"
 * button for a discoverable private channel: browse_channels.tsx races the typed-search
 * fetch against loadDiscoverableChannels(), and whichever resolves last overwrites the
 * other's row.
 */
test.fixme(
    'MM-68764 non-member requests to join a discoverable private channel from Browse Channels and can withdraw',
    {tag: ['@discoverable_channels']},
    async ({pw}) => {
        await pw.ensureFeatureFlag('DiscoverableChannels', true);

        // # Initialize setup and create a discoverable private channel the user is not a member of
        const {team, user, adminClient, townSquare} = await pw.initSetup();
        const channel = await createDiscoverableChannel(adminClient, team.id);

        // # Log in as the non-member user and open Browse Channels
        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        await app.lhs.header.openBrowseOrAddMenuButton.click();

        await expect(app.lhs.browseOrAddMenu.browseChannelsMenuItem).toBeVisible();
        await app.lhs.browseOrAddMenu.browseChannelsMenuItem.click();
        // Browse Channels has no declared scope in this area; keep its accessible dialog and scoped rows.
        const dialog = app.page.getByRole('dialog', {name: 'Browse Channels'});
        await expect(dialog).toBeVisible();

        // # Find the discoverable channel
        await dialog.getByRole('textbox', {name: 'Search channels'}).fill(channel.display_name);
        await expect(dialog.getByTestId('loading-screen')).toHaveCount(0);
        const row = dialog.getByRole('search').locator('.more-modal__row').filter({hasText: channel.display_name});

        // * The row offers "Request to join" rather than a Join button
        await expect(row.getByText('Request to join')).toBeVisible();

        // # Request to join and confirm in the modal
        await row.getByText('Request to join').click();
        await expect(page.getByRole('button', {name: 'Send Request'})).toBeVisible();
        await page.getByRole('button', {name: 'Send Request'}).click();

        // * The row flips to the pending "Withdraw" state
        await expect(row.getByText('Withdraw', {exact: true})).toBeVisible();

        // # Withdraw the request
        await row.getByText('Withdraw', {exact: true}).click();

        // * The row returns to the "Request to join" state
        await expect(row.getByText('Request to join')).toBeVisible();
    },
);

test(
    'MM-68764 selecting a discoverable private channel from Find Channels opens Request to Join, not the legacy join',
    {tag: ['@discoverable_channels']},
    async ({pw}) => {
        await pw.ensureFeatureFlag('DiscoverableChannels', true);

        // # Initialize setup and create a discoverable private channel the user is not a member of
        const {team, user, adminClient, townSquare} = await pw.initSetup();
        const channel = await createDiscoverableChannel(adminClient, team.id);

        // # Log in as the non-member user
        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Find Channels (Cmd/Ctrl+K) and locate the discoverable channel
        await app.center.postCreate.message.container.pressTo('ControlOrMeta+K', app.quickSwitchModal);
        await app.quickSwitchModal.searchTextbox.fill(channel.display_name);

        const result = app.quickSwitchModal.suggestions.suggestion(channel.id);
        await expect(result).toBeVisible();

        // # Select the discoverable channel
        await result.select();

        // * The Request to Join modal opens instead of the legacy private-channel join
        // confirmation, and no "Join private channel" dialog is shown.
        await expect(page.getByRole('button', {name: 'Send Request'})).toBeVisible();
        await expect(page.getByText('Are you sure you wish to join')).toHaveCount(0);
    },
);
