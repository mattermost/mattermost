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
    const {searchBox, searchResults, searchTeamSelector} = channelsPage;

    // Make sure the search box is open but doesn't have a team selector
    await expect(searchBox.container).toBeVisible();
    await expect(searchTeamSelector.container).not.toBeVisible();

    // # Now search for the message to see search results
    await searchBox.searchInput.fill(message);
    await channelsPage.page.keyboard.press('Enter');

    // # Wait for search results to load
    await expect(searchResults.container).toBeVisible();

    // * Verify the team selector is not visible in search results panel
    await expect(searchTeamSelector.resultsContainer).not.toBeVisible();
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
    const {searchBox, searchResults, searchTeamSelector} = channelsPage;

    // Make sure the search box is open and has a team selector
    await expect(searchBox.container).toBeVisible();
    await expect(searchTeamSelector.container).toBeVisible();

    // # Click on the team selector button
    await searchTeamSelector.menuButton.click();

    // * Verify that both teams are visible in the menu
    const teamSelector = searchTeamSelector.getTeamMenu();
    await expect(teamSelector).toBeVisible();
    await expect(teamSelector.getByText(team.display_name)).toBeVisible();
    await expect(teamSelector.getByText(secondTeam.display_name)).toBeVisible();
    await expect(teamSelector.getByText('All teams')).toBeVisible();

    // # Now search for the message to see search results
    await channelsPage.page.click('body', {position: {x: 0, y: 0}}); // Click away to close team selector
    await searchBox.searchInput.fill(message);
    await channelsPage.page.keyboard.press('Enter');

    // # Wait for search results to load
    await expect(searchResults.container).toBeVisible();

    // * Verify the team selector is visible in search results panel
    await expect(searchTeamSelector.resultsContainer).toBeVisible();

    // # Click on the team selector in results panel
    await searchTeamSelector.resultsMenuButton.click();

    // * Verify that both teams are visible in the results panel team selector
    const resultsTeamSelector = searchTeamSelector.getTeamMenu();
    await expect(resultsTeamSelector).toBeVisible();
    await expect(resultsTeamSelector.getByText(team.display_name)).toBeVisible();
    await expect(resultsTeamSelector.getByText(secondTeam.display_name)).toBeVisible();
    await expect(resultsTeamSelector.getByText('All teams')).toBeVisible();
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
    const {searchTeamSelector} = channelsPage;
    await expect(searchTeamSelector.container).toBeVisible();
    await searchTeamSelector.menuButton.click();

    // # Verify the team filter input is visible with 5 teams
    const teamSelector = searchTeamSelector.getTeamMenu();
    await expect(teamSelector).toBeVisible();
    await expect(teamSelector.getByLabel('Search teams')).toBeVisible();

    // # Verify all teams are visible initially
    for (const t of teams) {
        await expect(teamSelector.getByText(t.display_name)).toBeVisible();
    }

    // # Type filter text to match only one team
    await teamSelector.getByLabel('Search teams').fill(teams[2].display_name);

    // # Verify only the matching team is visible (and the currently selected team)
    await expect(teamSelector.getByText(teams[0].display_name)).toBeVisible(); // Current team always visible
    await expect(teamSelector.getByText(teams[2].display_name)).toBeVisible(); // Filtered team

    // # Verify other teams are hidden
    for (let i = 1; i < teams.length; i++) {
        if (i !== 2) {
            // Skip the filtered team we're expecting to see
            await expect(teamSelector.getByText(teams[i].display_name)).not.toBeVisible();
        }
    }

    // # Clear the filter
    await teamSelector.getByLabel('Search teams').fill('');

    // # Verify all teams are visible again
    for (const t of teams) {
        await expect(teamSelector.getByText(t.display_name)).toBeVisible();
    }
});
