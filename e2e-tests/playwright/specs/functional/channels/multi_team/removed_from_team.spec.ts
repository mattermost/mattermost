// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
