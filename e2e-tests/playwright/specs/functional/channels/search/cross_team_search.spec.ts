// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify cross-team search still renders the team selector and returns results correctly
 * when the Onyx (dark) theme is active.
 */
test('MM-T5806 cross-team search works under the Onyx (dark) theme', {tag: '@search'}, async ({pw}) => {
    // # Create a user with two teams and post a message to search for
    const {adminClient, team, user} = await pw.initSetup();
    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id]);

    const message = 'this is a test post containing the word pineapple';
    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.createPost({channel_id: channel.id, message});

    // # Log in and switch to the Onyx (dark) theme
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    const settingsModal = await channelsPage.openSettings();
    const displaySettings = await settingsModal.openDisplayTab();
    await displaySettings.selectPremadeTheme('Onyx');
    await settingsModal.close();

    // # Search for the message across teams
    await channelsPage.searchFor('pineapple');

    // * Verify the team selector and search results render correctly under the dark theme
    await channelsPage.searchResultsPanel.teamSelector.toBeVisible();
    await channelsPage.searchResultsPanel.toContainText(message);
});

/**
 * @objective Verify the team filter in the search team-selector menu shows no results for a
 * non-matching query, and correctly narrows to a single team for a partial matching query.
 */
test('MM-T5805 team filter shows no results for a non-matching query', {tag: '@search'}, async ({pw}) => {
    // # Create a user and enough teams (5 total) for the team-filter input to render
    // (see team_selector.spec.ts: the filter only shows with more than 4 teams)
    const {adminClient, team, user} = await pw.initSetup();

    const extraTeams: Record<string, Team> = {};
    for (const fruit of ['Apple', 'Banana', 'Peach', 'Grape']) {
        const newTeam = await adminClient.createTeam(await pw.random.team(fruit.toLowerCase(), fruit, 'O', true));
        await adminClient.addUsersToTeam(newTeam.id, [user.id]);
        extraTeams[fruit] = newTeam;
    }

    // # Log in, open search, and open the team selector
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openSearch();

    const teamSelector = channelsPage.searchBox.teamSelector;
    await teamSelector.open();
    await expect(teamSelector.filterInput).toBeVisible();

    // # Filter by a string that matches no team
    await teamSelector.filterBy('Rhino');

    // * Verify none of the fruit teams match, but the current team is still shown (current team is always visible)
    for (const fruit of Object.keys(extraTeams)) {
        await expect(teamSelector.teamOption(extraTeams[fruit].display_name)).not.toBeVisible();
    }
    await expect(teamSelector.teamOption(team.display_name)).toBeVisible();

    // # Filter by a partial string that matches exactly one team
    await teamSelector.filterBy('Banana');

    // * Verify only the matching team (plus the always-visible current team) is shown
    await expect(teamSelector.teamOption(extraTeams.Banana.display_name)).toBeVisible();
    await expect(teamSelector.teamOption(team.display_name)).toBeVisible();
    for (const fruit of ['Apple', 'Peach', 'Grape']) {
        await expect(teamSelector.teamOption(extraTeams[fruit].display_name)).not.toBeVisible();
    }
});

/**
 * @objective Verify the search team-selector defaults to the active team (not "All Teams"), that a
 * typed query persists across team-selector changes, and that the "Your teams" section header in
 * the dropdown only appears while a specific team (not "All Teams") is selected.
 */
test(
    'MM-T5801 team selector defaults to the active team, preserves the query, and hides "Your teams" for All Teams',
    {tag: '@search'},
    async ({pw}) => {
        // # Create a user and 4 more teams (5 total) so the "Your teams" section renders
        // (see team_selector.spec.ts: the filter/section only shows with more than 4 teams)
        const {adminClient, team, user} = await pw.initSetup();

        const teams = [team];
        for (let i = 0; i < 4; i++) {
            const newTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
            await adminClient.addUsersToTeam(newTeam.id, [user.id]);
            teams.push(newTeam);
        }
        const secondTeam = teams[1];

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();
        await channelsPage.globalHeader.openSearch();

        const teamSelector = channelsPage.searchBox.teamSelector;

        // * Verify the selector defaults to the currently active team, not "All Teams"
        await expect(teamSelector.menuButton).toContainText(team.display_name);

        // # Type a query without submitting, then switch the team selector to a different team
        await channelsPage.searchBox.searchInput.fill('pineapple');
        await teamSelector.selectTeam(secondTeam.display_name);

        // * Verify the button label updated and the query text was preserved
        await expect(teamSelector.menuButton).toContainText(secondTeam.display_name);
        await expect(channelsPage.searchBox.searchInput).toHaveValue('pineapple');

        // * Verify the "Your teams" section header is shown while a specific team is selected
        await teamSelector.open();
        await expect(teamSelector.yourTeamsHeader).toBeVisible();

        // # Switch to "All Teams" (the menu is already open from the check above)
        await teamSelector.teamOption('All Teams').click();

        // * Verify the "Your teams" section header is hidden once "All Teams" is selected
        await teamSelector.open();
        await expect(teamSelector.yourTeamsHeader).not.toBeVisible();
    },
);

/**
 * @objective Verify the "in:" channel filter is cleared from the search query when the team
 * selector is switched to "All Teams", since the filter only makes sense within a single team.
 *
 * @knownIssue Switching the team selector to "All Teams" does NOT clear the "in:<channel>" clause
 * from the query text — it's left in place, and submitting silently re-scopes the search back to
 * the channel's own team rather than actually searching "All Teams".
 */
test.fixme(
    'MM-T5804 "in:" channel filter is cleared when switching search to All Teams',
    {tag: '@search'},
    async ({pw}) => {
        // # Create a user with a second team so "All Teams" is a real, distinct selector choice
        const {adminClient, team, user} = await pw.initSetup();
        const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
        await adminClient.addUsersToTeam(secondTeam.id, [user.id]);
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        await channelsPage.globalHeader.openSearch();

        // # Type "in:" and pick the channel from the autocomplete suggestion
        const {searchInput} = channelsPage.searchBox;
        await searchInput.fill('in:');
        await searchInput.pressSequentially(channel.name);
        await channelsPage.searchBox.container.getByText(channel.display_name, {exact: false}).first().click();
        await expect(searchInput).toHaveValue(`in:${channel.name} `);

        // # Switch the team selector to "All Teams"
        await channelsPage.searchBox.teamSelector.selectAllTeams();

        // * Verify the "in:" clause was cleared, since it's meaningless once scoped to All Teams
        await expect(searchInput).not.toHaveValue(new RegExp(`in:${channel.name}`));
    },
);
