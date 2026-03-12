// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('user can view group details in the view user group modal @ai-assisted', async ({pw}) => {
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

    // * Verify the View User Group detail modal is visible
    const viewGroupDialog = page.locator('.view-user-groups-modal');
    await expect(viewGroupDialog).toBeVisible();

    // * Verify the @mention group name is shown
    await expect(viewGroupDialog.getByText(`@${group.name}`)).toBeVisible();

    // * Verify the member count heading shows 1 Member
    await expect(viewGroupDialog.getByText(/1\s*Member/i)).toBeVisible();

    // * Verify the member search input is present
    await expect(viewGroupDialog.getByTestId('searchInput')).toBeVisible();
});
