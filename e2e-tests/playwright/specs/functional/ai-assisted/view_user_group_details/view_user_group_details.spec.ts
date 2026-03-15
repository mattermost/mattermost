// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user can view group details including mention name and member count in the user group modal
 */
test('user can view group details in the view user group modal', {tag: ['@view_user_group_details', '@ai-assisted']}, async ({pw}) => {
    // # Set up admin and member user
    const {adminClient, user} = await pw.initSetup();

    // # Create a custom user group with the member user via the admin API
    const groupName = `test-group-${Date.now()}`;
    const group = await adminClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Test Group ${Date.now()}`,
        allow_reference: true,
        source: 'custom',
        user_ids: [user.id],
    });

    // # Login as the regular user
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the product switch / main menu
    await channelsPage.globalHeader.productSwitchMenu.click();

    // # Click the "User Groups" item in the product menu
    await page.getByRole('menuitem', {name: 'User Groups'}).click();

    // * Verify the User Groups modal is open
    const userGroupsDialog = page.getByRole('dialog', {name: 'User Groups'});
    await expect(userGroupsDialog).toBeVisible();

    // # Click on the newly created group to open its detail view
    await userGroupsDialog.getByText(group.display_name).click();

    // * Verify the View User Group detail view is visible
    const viewGroupDialog = page.getByRole('dialog').last();
    await expect(viewGroupDialog).toBeVisible();

    // * Verify the @mention group name is shown
    await expect(viewGroupDialog.getByText(`@${group.name}`)).toBeVisible();

    // * Verify the member count heading shows 1 Member
    await expect(viewGroupDialog.getByText(/1\s*Member/i)).toBeVisible();

    // * Verify the member search input is present
    await expect(viewGroupDialog.getByPlaceholder('Search')).toBeVisible();
});
