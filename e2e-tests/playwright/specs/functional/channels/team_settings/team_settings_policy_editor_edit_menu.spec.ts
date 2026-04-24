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
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_4 Team Admin uses three-dot Edit menu', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Menu ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Click three-dot menu then Edit
        const menuButton = teamSettings.container.locator(`button[id="policy-menu-${policy.id}"]`);
        await menuButton.click();
        await page.getByRole('menuitem', {name: 'Edit'}).click();

        // * Editor shown with pre-populated name
        await expect(teamSettings.container.locator('#input_policyName')).toHaveValue(policy.name);

        await teamSettings.close();
    });

    test('MM-67594_5 Undo discards changes', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Undo ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open editor and modify name
        await teamSettings.container.getByText(policy.name).click();

        await teamSettings.container.locator('#input_policyName').clear();
        await teamSettings.container.locator('#input_policyName').fill('Changed Name');

        // # Click Undo in SaveChangesPanel
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__cancel-btn"]').click();

        // * Name reverted to original
        await expect(teamSettings.container.locator('#input_policyName')).toHaveValue(policy.name);

        await teamSettings.close();
    });

    test('MM-67594_5b Back button then Undo navigates back to list', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA BackUndo ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open editor and make a change so the SaveChangesPanel is shown
        await teamSettings.container.getByText(policy.name).click();
        await teamSettings.container.locator('#input_policyName').fill('Changed Name');

        // # Click the back button — sets navigation intent but stays in editor because of unsaved changes
        await teamSettings.container.locator('.TeamPolicyEditor__back-btn').click();

        // # Click Undo — should revert changes AND navigate back to the list.
        // This validates the fix for the bug where the navigation intent expired after 3 seconds,
        // causing Undo to revert changes but leave the user stranded in the editor.
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__cancel-btn"]').click();

        // * List view restored (back navigation happened)
        await expect(teamSettings.container.getByRole('button', {name: 'Add policy'})).toBeVisible({timeout: 10000});

        await teamSettings.close();
    });
});
