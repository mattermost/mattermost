// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createRandomTeam} from '@e2e-support/server';
import {expect, test} from '@e2e-support/test_fixture';

test('team selector must show all my teams', async ({pw}) => {
    pw.skipIfFeatureFlagNotSet('ExperimentalCrossTeamSearch', true);

    const {adminClient, user, team} = await pw.initSetup();

    // # create 2 more teams and add the user to them
    const teams = [team];
    for (let i = 0; i < 2; i++) {
        const newTeam = await adminClient.createTeam(createRandomTeam('team', 'Team', 'O', true));
        await adminClient.addUsersToTeam(newTeam.id, [user.id]);
        teams.push(newTeam);
    }

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // * Check that the team selector is visible
    const page = channelsPage.page;
    await expect(page.getByTestId('searchTeamsSelectorMenuButton')).toBeVisible();

    // # Click on the team selector
    await page.getByTestId('searchTeamsSelectorMenuButton').click();

    // * Check that the team selector is visible
    const teamSelector = page.getByRole('menu', {name: 'Select team'});
    await expect(teamSelector).toBeVisible();
    // * Check that the team selector has the 3 teams
    teams.forEach(async (t) => {
        await expect(teamSelector.getByText(t.display_name)).toBeVisible();
    });
    // * Check that All teams is also visible
    await expect(teamSelector.getByText('All teams')).toBeVisible();
    // * No <input> should be visible in the menu
    await expect(teamSelector.getByLabel('Search teams')).not.toBeVisible();

    // now create and join 3 more teams
    for (let i = 0; i < 3; i++) {
        const newTeam = await adminClient.createTeam(createRandomTeam('team', 'Team', 'O', true));
        await adminClient.addUsersToTeam(newTeam.id, [user.id]);
        teams.push(newTeam);
    }

    // refresh the page
    await channelsPage.goto(team.name);

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // # Click on the team selector
    await page.getByTestId('searchTeamsSelectorMenuButton').click();

    // * Check that the team selector is visible
    await expect(teamSelector).toBeVisible();
    // * Check that the team selector has the 6 teams
    teams.forEach(async (t) => {
        await expect(teamSelector.getByText(t.display_name)).toBeVisible();
    });
    // * Check that All teams is also visible
    await expect(teamSelector.getByText('All teams')).toBeVisible();

    // because there's more than 4 teams, the filter input should be visible
    await expect(teamSelector.getByLabel('Search teams')).toBeVisible();

    // # Type the name of the first team
    await page.getByLabel('Search teams').fill(teams[3].display_name);

    // * Check that the team selector is visible
    await expect(teamSelector).toBeVisible();

    // * Noew team [0] and [3] should be visible - 0 is visible because it was currently selected.
    await expect(teamSelector.getByText(teams[0].display_name)).toBeVisible();
    await expect(teamSelector.getByText(teams[3].display_name)).toBeVisible();
    // * Check that All teams is also visible
    await expect(teamSelector.getByText('All teams')).toBeVisible();
    // * Check that the other teams are not visible
    teams.slice(1, 3).forEach(async (t) => {
        await expect(teamSelector.getByText(t.display_name)).not.toBeVisible();
    });
});
