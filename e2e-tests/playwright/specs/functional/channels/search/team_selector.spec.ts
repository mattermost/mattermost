// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';

import {Api, type App, expect, settle, test} from '@mattermost/playwright-lib';

/** Opens the search box from the global header. */
async function openSearch(app: App) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
}

/** Runs a search from the open search box and waits for the results panel. */
async function search(app: App, term: string) {
    await app.searchBox.inputSearchbox.fill(term);
    await app.searchBox.inputSearchbox.press('Enter');
    await expect(app.search.results).toBeVisible();
}

/** Switches to a team and leaves it from the team menu. */
async function leaveTeam(app: App, team: Team) {
    await app.teamSidebar.team(team).container.click();
    await expect(app.lhs.header.openTeamMenuButton).toContainText(team.display_name);
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.leaveTeamMenuItem);
    const modal = await app.lhs.teamMenu.leaveTeamMenuItem.clickTo(app.leaveTeamModal);
    await settle(modal.confirmButton, {wait: Api.RemoveTeamMember}).click();
}

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
    const {app} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the search UI
    await openSearch(app);

    // * Verify that the team selector is not visible in the search box
    await expect(app.searchBox.inputSearchbox).toBeVisible();
    await expect(app.searchBox.teamSelector).not.toBeVisible();

    // # Now search for the message to see search results
    await search(app, message);

    // * Verify the team selector is not visible in search results panel
    await expect(app.search.teamSelector).not.toBeVisible();
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
    const {app} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the search UI
    await openSearch(app);

    // * Verify that the team selector is visible in the search box
    await expect(app.searchBox.inputSearchbox).toBeVisible();
    const composerTeamSelector = app.searchBox.teamSelector;
    await expect(composerTeamSelector).toBeVisible();

    // # Click on the team selector button
    await composerTeamSelector.openMenuButton.clickTo(composerTeamSelector.menu.allTeamsMenuItemRadio);

    // * Verify that both teams are visible in the menu
    await expect(composerTeamSelector.menu.team(team)).toBeVisible();
    await expect(composerTeamSelector.menu.team(secondTeam)).toBeVisible();
    await expect(composerTeamSelector.menu.allTeamsMenuItemRadio).toBeVisible();

    // # Now search for the message to see search results
    await app.page.keyboard.press('Escape');
    await expect(composerTeamSelector.menu.allTeamsMenuItemRadio).not.toBeVisible();
    await search(app, message);

    // * Verify the team selector is visible in search results panel
    const resultsTeamSelector = app.search.teamSelector;
    await expect(resultsTeamSelector).toBeVisible();

    // # Click on the team selector in results panel
    await resultsTeamSelector.openMenuButton.clickTo(resultsTeamSelector.menu.allTeamsMenuItemRadio);

    // * Verify that both teams are visible in the results panel team selector
    await expect(resultsTeamSelector.menu.team(team)).toBeVisible();
    await expect(resultsTeamSelector.menu.team(secondTeam)).toBeVisible();
    await expect(resultsTeamSelector.menu.allTeamsMenuItemRadio).toBeVisible();
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
    const {app} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await app.teamPage.goto({team});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the search UI
    await openSearch(app);

    // # Verify team selector is visible and click on it
    const teamSelector = app.searchBox.teamSelector;
    await expect(teamSelector).toBeVisible();
    await teamSelector.openMenuButton.clickTo(teamSelector.menu.allTeamsMenuItemRadio);

    // # Verify the team filter input is visible with 5 teams
    await expect(teamSelector.menu.filter.container).toBeVisible();

    // # Verify all teams are visible initially
    for (const t of teams) {
        await expect(teamSelector.menu.team(t)).toBeVisible();
    }

    // # Type filter text to match only one team
    await teamSelector.menu.filter.container.fill(teams[2].display_name);

    // # Verify only the matching team is visible (and the currently selected team)
    await expect(teamSelector.menu.team(teams[0])).toBeVisible(); // Current team always visible
    await expect(teamSelector.menu.team(teams[2])).toBeVisible(); // Filtered team

    // # Verify other teams are hidden
    for (let i = 1; i < teams.length; i++) {
        if (i !== 2) {
            // Skip the filtered team we're expecting to see
            await expect(teamSelector.menu.team(teams[i])).not.toBeVisible();
        }
    }

    // # Clear the filter
    await teamSelector.menu.filter.container.fill('');
    await expect(teamSelector.menu.filter.container).toHaveValue('');

    // # Verify all teams are visible again
    for (const t of teams) {
        await expect(teamSelector.menu.team(t)).toBeVisible();
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
    const {app} = await pw.testBrowser.login(user);
    await app.teamPage.goto({team});
    await expect(app.center.postCreate).toBeVisible();
    await openSearch(app);

    const teamSelector = app.searchBox.teamSelector;
    await teamSelector.openMenuButton.clickTo(teamSelector.menu.allTeamsMenuItemRadio);

    // * Verify all 5 teams are listed initially
    for (const t of teams) {
        await expect(teamSelector.menu.team(t)).toBeVisible();
    }

    // # Close the menu, then switch to and leave one of the extra teams
    await app.page.keyboard.press('Escape');
    await expect(teamSelector.menu.allTeamsMenuItemRadio).not.toBeVisible();
    const teamToLeave = teams[teams.length - 1];
    await leaveTeam(app, teamToLeave);

    // # Reopen search and the team selector
    await expect(app.center.postCreate).toBeVisible();
    await openSearch(app);
    await teamSelector.openMenuButton.clickTo(teamSelector.menu.allTeamsMenuItemRadio);

    // * Verify the left team no longer appears in the filter list
    await expect(teamSelector.menu.team(teamToLeave)).not.toBeVisible();

    // * Verify the remaining teams are still listed
    for (const t of teams.slice(0, -1)) {
        await expect(teamSelector.menu.team(t)).toBeVisible();
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
    const {app} = await pw.testBrowser.login(user);
    await app.teamPage.goto({team});
    await expect(app.center.postCreate).toBeVisible();
    await openSearch(app);

    const composerTeamSelector = app.searchBox.teamSelector;
    await composerTeamSelector.openMenuButton.clickTo(composerTeamSelector.menu.allTeamsMenuItemRadio);
    await composerTeamSelector.menu.allTeamsMenuItemRadio.click();
    await expect(composerTeamSelector.openMenuButton).toContainText('All Teams');
    await search(app, 'pineapple');

    // * Verify both teams' messages show up
    await expect(app.search.results).toContainText(messageInFirstTeam);
    await expect(app.search.results).toContainText(messageInSecondTeam);

    // # Reopen the search composer and narrow its team selector to the second team specifically
    // (changing the team via the results panel's own selector updates state but does not refresh
    // the displayed results — the search must be resubmitted via the composer, as below)
    await openSearch(app);
    await composerTeamSelector.openMenuButton.clickTo(composerTeamSelector.menu.team(secondTeam));
    await composerTeamSelector.menu.team(secondTeam).click();
    await expect(composerTeamSelector.openMenuButton).toContainText(secondTeam.display_name);

    // # Re-submit the search now that the composer is scoped to the second team
    await app.searchBox.inputSearchbox.press('Enter');

    // * Verify only the second team's message shows
    await expect(app.search.results).toContainText(messageInSecondTeam);
    await expect(app.search.results).not.toContainText(messageInFirstTeam);

    // # Leave the second team and re-run the same search
    await leaveTeam(app, secondTeam);
    await expect(app.center.postCreate).toBeVisible();
    await openSearch(app);
    await search(app, 'pineapple');

    // * Verify only the first team's message shows now that the second team was left
    await expect(app.search.results).toContainText(messageInFirstTeam);
    await expect(app.search.results).not.toContainText(messageInSecondTeam);
});
