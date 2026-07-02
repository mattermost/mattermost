// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a system admin can edit a team's name and description from the
 * System Console Team Configuration page and that the changes are persisted.
 */
test('edits team name and description from the System Console', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a team with a known name and description
    const initialDescription = 'Initial team description';
    const team = await adminClient.createTeam({
        ...(await pw.random.team()),
        description: initialDescription,
    });

    // # Log in as a system admin and open the Team Configuration page
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const {page} = systemConsolePage;
    await page.goto(`/admin_console/user_management/teams/${team.id}`);

    const nameInput = page.getByTestId('teamNameInput');
    const descriptionInput = page.getByTestId('teamDescriptionInput');

    // * Verify the fields are prefilled with the current team values
    await expect(nameInput).toHaveValue(team.display_name);
    await expect(descriptionInput).toHaveValue(initialDescription);

    // # Edit the team name and description
    const newName = `Edited Name ${pw.random.id()}`;
    const newDescription = 'Edited team description';
    await nameInput.fill(newName);
    await descriptionInput.fill(newDescription);

    // # Save the changes
    await page.getByTestId('saveSetting').click();

    // * Verify the page returns to the teams list after a successful save
    await page.waitForURL(/\/admin_console\/user_management\/teams$/);

    // * Verify the changes were persisted on the server
    const updatedTeam = await adminClient.getTeam(team.id);
    expect(updatedTeam.display_name).toBe(newName);
    expect(updatedTeam.description).toBe(newDescription);
});

/**
 * @objective Verify saving a too-short team name is blocked with an inline validation
 * error and does not persist the change.
 */
test('blocks saving a team name shorter than the minimum length', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a team to edit
    const team = await adminClient.createTeam(await pw.random.team());

    // # Log in as a system admin and open the Team Configuration page
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const {page} = systemConsolePage;
    await page.goto(`/admin_console/user_management/teams/${team.id}`);

    const nameInput = page.getByTestId('teamNameInput');
    await expect(nameInput).toHaveValue(team.display_name);

    // # Enter a name below the minimum length and try to save
    await nameInput.fill('a');
    await page.getByTestId('saveSetting').click();

    // * Verify an inline validation error is shown and the page stays on the team
    await expect(page.getByText('Team name must be 2 or more characters')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin_console/user_management/teams/${team.id}$`));

    // * Verify the team name was not changed on the server
    const unchangedTeam = await adminClient.getTeam(team.id);
    expect(unchangedTeam.display_name).toBe(team.display_name);
});
