// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an admin can make a team member a Team Admin and back from the team's Members modal, and the
 * server stores each change.
 */
test('changes a member to Team Admin and back from the Members modal', {tag: '@team_settings'}, async ({pw}) => {
    const {adminUser, adminClient, user, team, townSquare} = await pw.initSetup();

    // # Log in as admin and open the team's Members modal from the team menu
    const {app} = await pw.testBrowser.login(adminUser);
    await app.channelsPage.goto({team, channel: townSquare});
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    const teamMenu = app.lhs.teamMenu;
    await teamMenu.membersMenuItem.click();
    const modal = app.teamMembersModal;
    await expect(modal).toBeVisible();

    // # Find the member and make them a Team Admin
    await modal.members.searchTextbox.fill(user.username);
    const row = modal.members.user(user);
    const action = row.action;
    // The role menu opens outside the row, so it is found from the app.
    const menu = app.teamMembersRoleMenu;
    await expect(action.roleButton).toHaveText('Member');
    await action.roleButton.clickTo(menu.removeMenuItem);
    await settle(menu.makeAdminMenuItem, {wait: Api.UpdateTeamMemberSchemeRoles}).click();

    // * The row and the server show the new role
    await expect(action.roleButton).toHaveText('Team Admin');
    await expect.poll(async () => (await adminClient.getTeamMember(team.id, user.id)).scheme_admin).toBe(true);

    // # Make them a member again
    await action.roleButton.clickTo(menu.removeMenuItem);
    await settle(menu.makeMemberMenuItem, {wait: Api.UpdateTeamMemberSchemeRoles}).click();

    // * The row and the server show the member role
    await expect(action.roleButton).toHaveText('Member');
    await expect.poll(async () => (await adminClient.getTeamMember(team.id, user.id)).scheme_admin).toBe(false);
});
