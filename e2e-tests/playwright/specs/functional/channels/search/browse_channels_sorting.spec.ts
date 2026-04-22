// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

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
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open the Browse Channels modal
        const dialog = await channelsPage.openBrowseChannelsModal();
        await dialog.toBeVisible();

        // # Search for the term that matches DisplayName on some channels and Purpose on others
        await dialog.fillSearchInput('gamma');
        await dialog.toBeDoneLoading();
        await dialog.toHaveNResults(4);

        // DisplayName matches come first, sorted alphabetically
        await dialog.toHaveChannelAsNthResult(displayMatchA.name, 0);
        await dialog.toHaveChannelAsNthResult(displayMatchB.name, 1);

        // Purpose-only matches come after, sorted alphabetically by DisplayName
        await dialog.toHaveChannelAsNthResult(purposeMatchA.name, 2);
        await dialog.toHaveChannelAsNthResult(purposeMatchB.name, 3);
    },
);
