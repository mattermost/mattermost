// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user viewing a team can leave it, is moved to another team they belong to, and
 * can rejoin the team they left.
 */
test('MM-T2547 leaves a team while viewing it and rejoins it', {tag: '@multi_team'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();

    // # Make the team open so it can be rejoined from the team selection page
    await adminClient.patchTeam({id: team.id, allow_open_invite: true});

    // # Add the user to a second team so there is another team to fall back to
    const secondTeam = await pw.createNewTeam(adminClient, {
        name: 'team',
        displayName: 'Second Team',
        type: 'O',
        unique: true,
    });
    await adminClient.addToTeam(secondTeam.id, user.id);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Leave the current team from the team menu
    await channelsPage.sidebarLeft.teamMenuButton.click();
    await channelsPage.teamMenu.toBeVisible();
    await channelsPage.teamMenu.clickLeaveTeam();

    // # Confirm leaving in the dialog
    await channelsPage.leaveTeamModal.toBeVisible();
    await channelsPage.leaveTeamModal.confirm();

    // * Verify the user is moved to the other team and the left team is gone from the team sidebar
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${secondTeam.name}/`);
    await expect(page.locator(`#${team.name}TeamButton`)).not.toBeVisible();

    // # Rejoin the left team from the team selection page
    await page.goto('/select_team');
    await page.getByRole('link', {name: team.display_name}).click();

    // * Verify the rejoined team is displayed again with its button in the sidebar
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${team.name}/`);
    await expect(page.locator(`#${team.name}TeamButton`)).toBeVisible();
});

/**
 * @objective Verify that when an admin removes a user from the team they are viewing, the user is moved off
 * that team in real time, and is re-added when the admin invites them back.
 */
test(
    'MM-T2548 removes the user from the team they are viewing and re-adds them',
    {tag: '@multi_team'},
    async ({pw}) => {
        const {user, team, adminClient} = await pw.initSetup();

        // # Add the user to a second team so there is another team to fall back to when removed
        const secondTeam = await pw.createNewTeam(adminClient, {
            name: 'team',
            displayName: 'Second Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(secondTeam.id, user.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await expect(page.locator(`#${team.name}TeamButton`)).toBeVisible();

        // # Remove the user from the team they are viewing
        await adminClient.removeFromTeam(team.id, user.id);

        // * Verify the user is moved off the removed team and its button disappears from the sidebar
        await expect(page.locator(`#${team.name}TeamButton`)).not.toBeVisible();
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${secondTeam.name}/`);

        // # Re-add the user to the team
        await adminClient.addToTeam(team.id, user.id);

        // * Verify the team reappears in the sidebar for the user
        await expect(page.locator(`#${team.name}TeamButton`)).toBeVisible();
    },
);
