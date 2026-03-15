// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user can view group members and search within the user group modal
 */
test('user can view group members and search within the view user group modal', {tag: ['@view_user_group_modal', '@ai-assisted']}, async ({pw}) => {
    // # Set up admin and member user
    const {adminClient, user} = await pw.initSetup();

    // # Create a second user to be added to the group
    const secondUser = await adminClient.createUser(await pw.random.user(), '', '');

    // # Create a custom user group with both users via the admin API
    const groupName = `test-group-${Date.now()}`;
    const group = await adminClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Test Group ${Date.now()}`,
        allow_reference: true,
        source: 'custom',
        user_ids: [user.id, secondUser.id],
    });

    // # Login as the regular user
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the product switch menu and navigate to User Groups
    await channelsPage.globalHeader.productSwitchMenu.click();
    await page.getByRole('menuitem', {name: 'User Groups'}).click();

    // * Verify the User Groups modal is open
    const userGroupsDialog = page.getByRole('dialog', {name: 'User Groups'});
    await expect(userGroupsDialog).toBeVisible();

    // # Click on the newly created group to open the view user group modal
    await userGroupsDialog.getByText(group.display_name).click();

    // * Verify the view user group modal is visible
    const viewGroupModal = page.getByRole('dialog').last();
    await expect(viewGroupModal).toBeVisible();

    // * Verify the @mention group name is displayed
    await expect(viewGroupModal.getByText(`@${group.name}`)).toBeVisible();

    // * Verify the member count shows 2 Members
    await expect(viewGroupModal.getByText(/2\s*Members/i)).toBeVisible();

    // * Verify the member search input is present
    const searchInput = viewGroupModal.getByPlaceholder('Search');
    await expect(searchInput).toBeVisible();

    // # Search for the second user by username
    await searchInput.fill(secondUser.username);

    // * Verify the second user appears in the search results
    await expect(viewGroupModal.getByText(secondUser.username)).toBeVisible();

    // * Verify the first user (the logged-in user) does not appear in filtered results
    await expect(viewGroupModal.getByText(user.username)).not.toBeVisible();
});
