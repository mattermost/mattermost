// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('team selector should not be visible if user belongs to only one team', async ({pw}) => {
    // # Create a user with only one team
    const {adminClient, user, team} = await pw.initSetup();

    // # Create a channel in the team
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Test Channel',
            name: 'test-channel',
        }),
    );

    // # Post a message in the channel
    const message = 'test message for search';
    await adminClient.createPost({
        channel_id: channel.id,
        message,
    });

    // # Log in as the user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // * Verify that the team selector is not visible in the search box
    await channelsPage.searchBox.toBeVisible();
    await channelsPage.searchBox.teamSelector.notToBeVisible();

    // # Now search for the message to see search results
    await channelsPage.searchBox.search(message);
    await channelsPage.searchResultsPanel.toBeVisible();

    // * Verify the team selector is not visible in search results panel
    await channelsPage.searchResultsPanel.teamSelector.notToBeVisible();
});

test('team selector should be visible if user belongs to multiple teams', async ({pw}) => {
    // # Create a user and admin client
    const {adminClient, user, team} = await pw.initSetup();

    // # Create a second team and add the user to it
    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id]);

    // # Create a channel in the first team
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Test Channel',
            name: 'test-channel-multi',
        }),
    );

    // # Post a message in the channel
    const message = 'test message for multiple teams search';
    await adminClient.createPost({
        channel_id: channel.id,
        message,
    });

    // # Log in as the user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // * Verify that the team selector is visible in the search box
    await channelsPage.searchBox.toBeVisible();
    const composerTeamSelector = channelsPage.searchBox.teamSelector;
    await composerTeamSelector.toBeVisible();

    // # Click on the team selector button
    await composerTeamSelector.open();

    // * Verify that both teams are visible in the menu
    await expect(composerTeamSelector.teamOption(team.display_name)).toBeVisible();
    await expect(composerTeamSelector.teamOption(secondTeam.display_name)).toBeVisible();
    await expect(composerTeamSelector.teamOption('All Teams')).toBeVisible();

    // # Now search for the message to see search results
    await composerTeamSelector.close();
    await channelsPage.searchBox.search(message);
    await channelsPage.searchResultsPanel.toBeVisible();

    // * Verify the team selector is visible in search results panel
    const resultsTeamSelector = channelsPage.searchResultsPanel.teamSelector;
    await resultsTeamSelector.toBeVisible();

    // # Click on the team selector in results panel
    await resultsTeamSelector.open();

    // * Verify that both teams are visible in the results panel team selector
    await expect(resultsTeamSelector.teamOption(team.display_name)).toBeVisible();
    await expect(resultsTeamSelector.teamOption(secondTeam.display_name)).toBeVisible();
    await expect(resultsTeamSelector.teamOption('All Teams')).toBeVisible();
});

test('team selector should show filter input with more than 4 teams', async ({pw}) => {
    // # Create a user and admin client
    const {adminClient, user, team} = await pw.initSetup();

    // # Create 4 more teams (for a total of 5) and add the user to them
    const teams = [team];
    for (let i = 0; i < 4; i++) {
        const newTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
        await adminClient.addUsersToTeam(newTeam.id, [user.id]);
        teams.push(newTeam);
    }

    // # Log in as the user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // # Verify team selector is visible and click on it
    const teamSelector = channelsPage.searchBox.teamSelector;
    await teamSelector.toBeVisible();
    await teamSelector.open();

    // # Verify the team filter input is visible with 5 teams
    await expect(teamSelector.filterInput).toBeVisible();

    // # Verify all teams are visible initially
    for (const t of teams) {
        await expect(teamSelector.teamOption(t.display_name)).toBeVisible();
    }

    // # Type filter text to match only one team
    await teamSelector.filterBy(teams[2].display_name);

    // # Verify only the matching team is visible (and the currently selected team)
    await expect(teamSelector.teamOption(teams[0].display_name)).toBeVisible(); // Current team always visible
    await expect(teamSelector.teamOption(teams[2].display_name)).toBeVisible(); // Filtered team

    // # Verify other teams are hidden
    for (let i = 1; i < teams.length; i++) {
        if (i !== 2) {
            // Skip the filtered team we're expecting to see
            await expect(teamSelector.teamOption(teams[i].display_name)).not.toBeVisible();
        }
    }

    // # Clear the filter
    await teamSelector.filterBy('');

    // # Verify all teams are visible again
    for (const t of teams) {
        await expect(teamSelector.teamOption(t.display_name)).toBeVisible();
    }
});

test('MM-T5802 team filter list updates when a team is left', async ({pw}) => {
    // # Create a user and 4 more teams (5 total) so the team-filter input renders
    const {adminClient, team, user} = await pw.initSetup();

    const teams = [team];
    for (let i = 0; i < 4; i++) {
        const newTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
        await adminClient.addUsersToTeam(newTeam.id, [user.id]);
        teams.push(newTeam);
    }

    // # Log in as the user and open the team selector
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openSearch();

    const teamSelector = channelsPage.searchBox.teamSelector;
    await teamSelector.open();

    // * Verify all 5 teams are listed initially
    for (const t of teams) {
        await expect(teamSelector.teamOption(t.display_name)).toBeVisible();
    }

    // # Close the menu, then switch to and leave one of the extra teams
    await teamSelector.close();
    const teamToLeave = teams[teams.length - 1];
    await channelsPage.leaveTeam(teamToLeave.name);

    // # Reopen search and the team selector
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openSearch();
    await teamSelector.open();

    // * Verify the left team no longer appears in the filter list
    await expect(teamSelector.teamOption(teamToLeave.display_name)).not.toBeVisible();

    // * Verify the remaining teams are still listed
    for (const t of teams.slice(0, -1)) {
        await expect(teamSelector.teamOption(t.display_name)).toBeVisible();
    }
});

test('MM-T5803 search results narrow to the selected team and update after leaving that team', async ({pw}) => {
    // # Create a user with two teams, each containing a distinct message
    const {adminClient, team, user} = await pw.initSetup();
    const secondTeam = await adminClient.createTeam(await pw.random.team('team', 'Team', 'O', true));
    await adminClient.addUsersToTeam(secondTeam.id, [user.id]);

    const messageInFirstTeam = 'pineapple message in the first team';
    const messageInSecondTeam = 'pineapple message in the second team';
    const firstChannel = await adminClient.getChannelByName(team.id, 'town-square');
    const secondChannel = await adminClient.getChannelByName(secondTeam.id, 'town-square');
    await adminClient.createPost({channel_id: firstChannel.id, message: messageInFirstTeam});
    await adminClient.createPost({channel_id: secondChannel.id, message: messageInSecondTeam});

    // # Log in, open search, and explicitly select "All Teams"
    // (the selector defaults to the currently active team, not "All Teams", on a fresh open)
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openSearch();

    const composerTeamSelector = channelsPage.searchBox.teamSelector;
    await composerTeamSelector.selectAllTeams();
    await channelsPage.searchBox.search('pineapple');

    // * Verify both teams' messages show up
    await channelsPage.searchResultsPanel.toContainText(messageInFirstTeam);
    await channelsPage.searchResultsPanel.toContainText(messageInSecondTeam);

    // # Reopen the search composer and narrow its team selector to the second team specifically
    // (changing the team via the results panel's own selector updates state but does not refresh
    // the displayed results — the search must be resubmitted via the composer, as below)
    await channelsPage.globalHeader.openSearch();
    await composerTeamSelector.selectTeam(secondTeam.display_name);

    // # Re-submit the search now that the composer is scoped to the second team
    await channelsPage.searchBox.searchInput.click();
    await channelsPage.searchBox.searchInput.press('Enter');

    // * Verify only the second team's message shows
    await expect(channelsPage.searchResultsPanel.container).toContainText(messageInSecondTeam);
    await expect(channelsPage.searchResultsPanel.container).not.toContainText(messageInFirstTeam);

    // # Leave the second team and re-run the same search
    await channelsPage.leaveTeam(secondTeam.name);
    await channelsPage.toBeVisible();
    await channelsPage.searchFor('pineapple');

    // * Verify only the first team's message shows now that the second team was left
    await expect(channelsPage.searchResultsPanel.container).toContainText(messageInFirstTeam);
    await expect(channelsPage.searchResultsPanel.container).not.toContainText(messageInSecondTeam);
});
