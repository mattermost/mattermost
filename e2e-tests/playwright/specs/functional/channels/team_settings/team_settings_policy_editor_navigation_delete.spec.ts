// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {expect, test} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createParentPolicy,
    createPrivateChannel,
    createTeamAdmin,
    loginAndOpenPoliciesTab,
    setUserAttribute,
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_6 Back button returns to list', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open editor then click back
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await teamSettings.container.locator('.TeamPolicyEditor__back-btn').click();

        // * List view restored
        await expect(teamSettings.container.getByRole('button', {name: 'Add policy'})).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_7 Delete policy from editor view', async ({pw}) => {
        const {adminUser, adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Delete Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, adminUser, team.name);

        // # Open editor
        await teamSettings.container.getByText(policy.name).click();

        // # Remove the channel to enable delete (click Remove link in channel list)
        await teamSettings.container.getByText('Remove').first().click();

        // # Click Delete in the delete section
        await teamSettings.container
            .locator('.TeamPolicyEditor__section--delete button')
            .filter({hasText: 'Delete'})
            .click();

        // # Confirm in delete confirmation modal
        await page.locator('.TeamPolicyEditor__delete-modal').waitFor();
        await page.locator('.TeamPolicyEditor__delete-modal').getByRole('button', {name: 'Delete'}).click();

        // * Back to list, policy removed
        await expect(teamSettings.container.getByText(policy.name)).not.toBeVisible();

        await teamSettings.close();
    });

    // Delete action is hidden in the team settings three-dot menu (all listed policies have channels).

    test('MM-67594_1 Team admin can delete policy after removing all channels', async ({pw}) => {
        // Scenario: Policy created via API → team admin opens editor → removes channel → deletes.
        // Validates that the scope field persists team ownership through channel removal.
        const {adminClient, team} = await setupTeamWithABAC(pw);

        // # Setup: create channel, policy, and assign via API (fast, non-flaky)
        const channel = await createPrivateChannel(adminClient, team.id);
        const policyName = `Scope Delete ${Date.now()}`;
        const policy = await createParentPolicy(adminClient, policyName);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        // # Create team admin and add to channel so they can see the policy
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await adminClient.addToChannel(teamAdmin.id, channel.id);

        // # Team admin logs in and opens team settings
        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // * Policy is visible
        await expect(teamSettings.container.getByText(policyName)).toBeVisible({timeout: 10000});

        // # Open editor by clicking policy row
        await teamSettings.container.getByText(policyName).click();

        // # Remove the channel to enable delete
        const removeLink = teamSettings.container.getByText('Remove').first();
        await expect(removeLink).toBeVisible({timeout: 10000});
        await removeLink.click();

        // # Click Delete in the delete section
        const deleteBtn = teamSettings.container
            .locator('.TeamPolicyEditor__section--delete button')
            .filter({hasText: 'Delete'});
        await expect(deleteBtn).toBeEnabled({timeout: 10000});
        await deleteBtn.click();

        // # Confirm deletion
        const deleteModal = page.locator('.TeamPolicyEditor__delete-modal');
        await expect(deleteModal).toBeVisible({timeout: 10000});
        await deleteModal.getByRole('button', {name: 'Delete'}).click();

        // * Back to list, policy is removed
        await expect(teamSettings.container.getByText(policyName)).not.toBeVisible();

        await teamSettings.close();
    });
});
