// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, test, waitForApi} from '@mattermost/playwright-lib';

/**
 * @objective Verify that Browse Channels modal search results prioritize channels whose DisplayName matches the search
 * term over channels that only match on other fields.
 */
test(
    'MM-67953 Browse Channels modal prioritizes DisplayName matches in search results',
    {tag: ['@browse_channels']},
    async ({pw}) => {
        // # Initialize setup
        const {team, user, adminClient} = await pw.initSetup();

        // # Create channels whose DisplayName matches the search term
        const displayMatchA = await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-gamma-conversation-' + Date.now(),
            display_name: 'Gamma: Conversation',
            type: 'O',
        });
        const displayMatchB = await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-gamma-logs-' + Date.now(),
            display_name: 'Gamma: Logs',
            type: 'O',
        });

        // # Create channels whose Purpose matches but DisplayName does NOT
        const purposeMatchA = await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-alpha-channel-' + Date.now(),
            display_name: 'Alpha Channel',
            type: 'O',
            purpose: 'alpha release of gamma',
        });
        const purposeMatchB = await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-beta-channel-' + Date.now(),
            display_name: 'Beta Channel',
            type: 'O',
            purpose: 'beta release of gamma',
        });

        // # Log in as regular user
        const {app} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Open the Browse Channels modal
        await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.browseChannelsMenuItem);
        const dialog = await app.lhs.browseOrAddMenu.browseChannelsMenuItem.clickTo(app.browseChannels);

        // # Search for the term that matches DisplayName on some channels and Purpose on others
        await Promise.all([
            waitForApi(app.page, Api.SearchAllChannels, {
                predicate: (_, response) => response.request().postDataJSON()?.term === 'gamma',
            }),
            dialog.searchTextbox.fill('gamma'),
        ]);
        await expect(dialog.loading).toHaveCount(0);

        // * DisplayName matches come first, sorted alphabetically; purpose-only matches come after, sorted
        //   alphabetically by DisplayName
        await expect(dialog.results.channelList).toHaveKeys([
            displayMatchA.id,
            displayMatchB.id,
            purposeMatchA.id,
            purposeMatchB.id,
        ]);
    },
);
