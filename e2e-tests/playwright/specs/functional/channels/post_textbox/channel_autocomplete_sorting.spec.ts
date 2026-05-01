// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the "Other Channels" group in the ~channel autocomplete in the message input prioritizes
 * channels whose DisplayName matches the search term.
 */
test(
    'MM-67953 channel mention autocomplete prioritizes DisplayName matches in Other Channels',
    {tag: ['@mentions']},
    async ({pw}) => {
        // # Initialize setup
        const {team, user, adminClient} = await pw.initSetup();

        // # Create channels whose DisplayName matches the search term (user is NOT a member)
        await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-gamma-conversation-' + Date.now(),
            display_name: 'Gamma: Conversation',
            type: 'O',
        });
        await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-gamma-logs-' + Date.now(),
            display_name: 'Gamma: Logs',
            type: 'O',
        });

        // # Create channels whose Purpose matches but DisplayName does NOT (user is NOT a member)
        await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-alpha-channel-' + Date.now(),
            display_name: 'Alpha Channel',
            type: 'O',
            purpose: 'alpha release of gamma',
        });
        await adminClient.createChannel({
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

        // # Type a channel mention in the message input to trigger autocomplete
        await channelsPage.centerView.postCreate.writeMessage('~gamma');

        // # Wait for the suggestion list to appear
        const suggestionList = channelsPage.centerView.postCreate.suggestionList;
        await expect(suggestionList).toBeVisible();

        // # Get all suggestion items within the "Other Channels" group
        const otherChannelsGroup = suggestionList.getByRole('group', {name: 'Other Channels'});
        await expect(otherChannelsGroup).toBeVisible();

        const suggestions = otherChannelsGroup.getByRole('option');

        // * Verify at least 4 suggestions are shown in "Other Channels"
        await expect(suggestions).toHaveCount(4);

        // * Verify DisplayName-matching channels appear first, sorted alphabetically
        await expect(suggestions.nth(0)).toContainText('Gamma: Conversation');
        await expect(suggestions.nth(1)).toContainText('Gamma: Logs');

        // * Verify Purpose-only-matching channels appear after, sorted alphabetically by DisplayName
        await expect(suggestions.nth(2)).toContainText('Alpha Channel');
        await expect(suggestions.nth(3)).toContainText('Beta Channel');
    },
);
