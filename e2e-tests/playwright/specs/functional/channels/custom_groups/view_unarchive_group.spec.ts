// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a custom user group can be archived, viewed under the archived filter, and restored.
 */
test('MM-T5584 views and unarchives a custom group', {tag: '@channels'}, async ({pw}) => {
    const {user, team, userClient} = await pw.initSetup();

    // # Create a custom group owned by the user
    const groupName = `group${pw.random.id()}`.toLowerCase();
    const group = await userClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Testing Group ${pw.random.id()}`,
        source: 'custom',
        allow_reference: true,
        user_ids: [user.id],
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const groupModal = channelsPage.getViewUserGroupModal(group.display_name);

    // # Open the User Groups modal from the product menu
    await channelsPage.globalHeader.openUserGroups();
    await channelsPage.userGroupsModal.toBeVisible();

    // # Open the group and archive it
    await channelsPage.userGroupsModal.openGroup(group.display_name);
    await groupModal.archive();

    // # Filter the list to archived groups and open the archived group
    await channelsPage.userGroupsModal.filterArchived();
    await channelsPage.userGroupsModal.openGroup(group.display_name);

    // # Restore the group
    await groupModal.restore();

    // * Verify the group is restored (member management is available again)
    await expect(groupModal.addPeopleButton).toBeVisible();
});
