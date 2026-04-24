// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {expect, test} from '@mattermost/playwright-lib';

import {
    addAttributeRule,
    addChannelToPolicy,
    assignChannelsToPolicy,
    createParentPolicy,
    createPrivateChannel,
    createTeamAdmin,
    loginAndOpenPoliciesTab,
    setUserAttribute,
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_8 Save without name shows validation error', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open create editor, add rule + channel but leave name empty
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await addAttributeRule(teamSettings.container, page, 'Engineering');
        await addChannelToPolicy(teamSettings.container, page, channel.display_name);

        // # Click Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Error state shown in SaveChangesPanel (name required)
        await expect(teamSettings.container.locator('.SaveChangesPanel.error')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_10 Save without channels shows validation error', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open create editor, add name + rule but no channels
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await teamSettings.container.locator('#input_policyName').fill(`No Channels ${Date.now()}`);
        await addAttributeRule(teamSettings.container, page, 'Engineering');

        // # Click Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Error state shown in SaveChangesPanel (channels required)
        await expect(teamSettings.container.locator('.SaveChangesPanel.error')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_11 Delete button disabled when policy has channels', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA HasChannels ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open editor
        await teamSettings.container.getByText(policy.name).click();

        // * Delete button is disabled (policy has channels)
        const deleteBtn = teamSettings.container
            .locator('.TeamPolicyEditor__section--delete button')
            .filter({hasText: 'Delete'});
        await expect(deleteBtn).toBeDisabled();

        await teamSettings.close();
    });
});
