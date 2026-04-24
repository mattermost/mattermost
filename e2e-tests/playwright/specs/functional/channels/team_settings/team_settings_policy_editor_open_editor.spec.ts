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
    test('MM-67594_1 Add policy button opens the editor view', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Click Add policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        // * Editor view shown with back button and name input
        await expect(teamSettings.container.locator('.TeamPolicyEditor__back-btn')).toBeVisible();
        await expect(teamSettings.container.locator('#input_policyName')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_2 Team Admin creates a new policy', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        // # Create private channel and team admin with Department=Engineering
        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Click Add policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        // # Fill policy name
        const policyName = `TA Policy ${Date.now()}`;
        await teamSettings.container.locator('#input_policyName').fill(policyName);

        // # Add a rule row and fill in a value
        await addAttributeRule(teamSettings.container, page, 'Engineering');

        // # Add channel via channel selector
        await addChannelToPolicy(teamSettings.container, page, channel.display_name);

        // * Confirm the channel appears in the editor list before saving
        await expect(teamSettings.container.getByText(channel.display_name)).toBeVisible({timeout: 10000});

        // # Save via SaveChangesPanel — wait for button to be enabled (form fully dirty).
        const saveBtn = teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 20000});
        await saveBtn.click();

        // # Confirm in PolicyConfirmationModal
        await page.locator('.TeamPolicyConfirmationModal').waitFor({timeout: 30000});
        await page.getByRole('button', {name: /Apply policy/}).click();

        // * Auto-navigated back to list, policy name visible.
        await expect(teamSettings.container.getByText(policyName)).toBeVisible({timeout: 15000});

        await teamSettings.close();
    });

    test('MM-67594_3 Team Admin edits existing policy via row click', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Edit ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Click policy row
        await teamSettings.container.getByText(policy.name).click();

        // * Editor shown with pre-populated name
        await expect(teamSettings.container.locator('#input_policyName')).toHaveValue(policy.name);

        // # Modify name
        const newName = `TA Updated ${Date.now()}`;
        await teamSettings.container.locator('#input_policyName').clear();
        await teamSettings.container.locator('#input_policyName').fill(newName);

        // # Save via SaveChangesPanel (name-only change skips confirmation modal)
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Auto-navigated back to list, updated name visible
        await expect(teamSettings.container.getByText(newName)).toBeVisible();

        await teamSettings.close();
    });
});
