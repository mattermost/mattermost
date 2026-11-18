// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';

import {settle, Api, expect, systemConsolePath, test, type App} from '@mattermost/playwright-lib';

/** Opens the team's System Console page, waiting for its name to load. */
async function openTeamConfig(app: App, team: Team) {
    await app.page.goto(systemConsolePath(`user_management/teams/${team.id}`));
    const page = app.admin.team;
    await expect(page.name.container).toHaveValue(team.display_name);
    return page;
}

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
    const {app} = await pw.testBrowser.login(adminUser);
    const page = await openTeamConfig(app, team);

    // * Verify the description is prefilled too
    await expect(page.description.container).toHaveValue(initialDescription);

    // # Edit the team name and description, and save
    const newName = `Edited Name ${pw.random.id()}`;
    const newDescription = 'Edited team description';
    await page.name.container.fill(newName);
    await page.description.container.fill(newDescription);
    await settle(page.savePanel.saveButton, {wait: Api.PatchTeam}).click();

    // * Verify the page returns to the teams list after a successful save
    await expect(app.page).toHavePath(systemConsolePath('user_management/teams'));

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
    const {app} = await pw.testBrowser.login(adminUser);
    const page = await openTeamConfig(app, team);

    // * No validation error before the change
    await expect(page.name.validationAlert).toHaveCount(0);

    // # Enter a name below the minimum length and try to save
    await page.name.container.fill('a');
    await page.savePanel.saveButton.click();

    // * Verify an inline validation error is shown and the page stays on the team
    await expect(page.name.validationAlert).toContainText('Team name must be 2 or more characters');
    await expect(app.page).toHavePath(`/admin_console/user_management/teams/${team.id}`);

    // * Verify the team name was not changed on the server
    const unchangedTeam = await adminClient.getTeam(team.id);
    expect(unchangedTeam.display_name).toBe(team.display_name);
});

/**
 * @objective Verify that toggling Archive Team with a too-short team name surfaces the
 * inline validation error on Save instead of leaving the "Save and Archive Team"
 * confirmation modal stuck open with no feedback.
 */
test('blocks archiving a team when the team name is invalid', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a team to edit
    const team = await adminClient.createTeam(await pw.random.team());

    // # Log in as a system admin and open the Team Configuration page
    const {app} = await pw.testBrowser.login(adminUser);
    const page = await openTeamConfig(app, team);

    // # Enter a name below the minimum length, then toggle the team to be archived, and try to save
    await page.name.container.fill('a');
    await page.archiveButton.click();
    await expect(page.archiveButton).toContainText('Unarchive Team');
    await page.savePanel.saveButton.click();

    // * Verify the inline validation error is shown, and the Save and Archive Team confirmation did not open
    await expect(page.name.validationAlert).toContainText('Team name must be 2 or more characters');
    await expect(page.archiveModal.confirmButton).toHaveCount(0);

    // * Verify the team was neither renamed nor archived on the server
    const unchangedTeam = await adminClient.getTeam(team.id);
    expect(unchangedTeam.display_name).toBe(team.display_name);
    expect(unchangedTeam.delete_at).toBe(0);
});
