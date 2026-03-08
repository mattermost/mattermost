// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createParentPolicy,
    assignChannelsToPolicy,
    createPrivateChannel,
    createTeamAdmin,
} from './helpers';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_1 Add policy button opens the editor view', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Click Add policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        // * Editor view shown with back button and name input
        await expect(teamSettings.container.locator('.TeamPolicyEditor__back-btn')).toBeVisible();
        await expect(teamSettings.container.getByPlaceholder('Add a unique policy name')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_2 Team Admin creates a new policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Click Add policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        // # Fill policy name
        const policyName = `TA Policy ${Date.now()}`;
        await teamSettings.container.getByPlaceholder('Add a unique policy name').fill(policyName);

        // # Add a rule via the table editor
        const attributeDropdown = teamSettings.container.locator('select').first();
        await attributeDropdown.selectOption('Department');
        const operatorDropdown = teamSettings.container.locator('select').nth(1);
        await operatorDropdown.selectOption('==');
        const valueInput = teamSettings.container.locator('.table-editor input[type="text"]').last();
        await valueInput.fill('Engineering');

        // # Save via SaveChangesPanel
        await teamSettings.container.getByRole('button', {name: 'Save'}).click();
        await page.waitForLoadState('networkidle');

        // # Navigate back to list
        await teamSettings.container.locator('.TeamPolicyEditor__back-btn').click();

        // * Policy name visible in list
        await expect(teamSettings.container.getByText(policyName)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_3 Team Admin edits existing policy via row click', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Edit ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Click policy row
        await teamSettings.container.getByText(policy.name).click();
        await page.waitForLoadState('networkidle');

        // * Editor shown with pre-populated name
        await expect(teamSettings.container.getByPlaceholder('Add a unique policy name')).toHaveValue(policy.name);

        // # Modify name
        const newName = `TA Updated ${Date.now()}`;
        await teamSettings.container.getByPlaceholder('Add a unique policy name').clear();
        await teamSettings.container.getByPlaceholder('Add a unique policy name').fill(newName);

        // # Save via SaveChangesPanel
        await teamSettings.container.getByRole('button', {name: 'Save'}).click();
        await page.waitForLoadState('networkidle');

        // # Navigate back to list
        await teamSettings.container.locator('.TeamPolicyEditor__back-btn').click();

        // * Updated name in list
        await expect(teamSettings.container.getByText(newName)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_4 Team Admin uses three-dot Edit menu', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Menu ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Click three-dot menu then Edit
        const menuButton = teamSettings.container.locator(`button[id="policy-menu-${policy.id}"]`);
        await menuButton.click();
        await page.getByRole('menuitem', {name: 'Edit'}).click();
        await page.waitForLoadState('networkidle');

        // * Editor shown with pre-populated name
        await expect(teamSettings.container.getByPlaceholder('Add a unique policy name')).toHaveValue(policy.name);

        await teamSettings.close();
    });

    test('MM-67594_5 Undo discards changes', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Undo ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open editor and modify name
        await teamSettings.container.getByText(policy.name).click();
        await page.waitForLoadState('networkidle');
        await teamSettings.container.getByPlaceholder('Add a unique policy name').clear();
        await teamSettings.container.getByPlaceholder('Add a unique policy name').fill('Changed Name');

        // # Click Undo in SaveChangesPanel
        await teamSettings.container.getByRole('button', {name: 'Undo'}).click();

        // * Name reverted to original
        await expect(teamSettings.container.getByPlaceholder('Add a unique policy name')).toHaveValue(policy.name);

        await teamSettings.close();
    });

    test('MM-67594_6 Back button returns to list', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open editor then click back
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await teamSettings.container.locator('.TeamPolicyEditor__back-btn').click();

        // * List view restored
        await expect(teamSettings.container.getByRole('button', {name: 'Add policy'})).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_7 Delete policy from editor view', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Delete Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open editor
        await teamSettings.container.getByText(policy.name).click();
        await page.waitForLoadState('networkidle');

        // # Remove the channel (click Remove link)
        await teamSettings.container.getByText('Remove').first().click();

        // # Click Delete in the delete section
        await teamSettings.container.getByRole('button', {name: 'Delete'}).last().click();
        await page.waitForLoadState('networkidle');

        // * Back to list, policy removed
        await expect(teamSettings.container.getByText(policy.name)).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_8 Delete is disabled when policy has channels assigned', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA NoDelete ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open three-dot menu
        const menuButton = teamSettings.container.locator(`button[id="policy-menu-${policy.id}"]`);
        await menuButton.click();

        // * Delete menu item is disabled
        const deleteItem = page.locator(`#policy-menu-delete-${policy.id}`);
        await expect(deleteItem).toHaveAttribute('aria-disabled', 'true');

        await teamSettings.close();
    });

    test('MM-67594_9 System Admin can also create policy from Team Settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Create policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        const policyName = `SysAdmin Policy ${Date.now()}`;
        await teamSettings.container.getByPlaceholder('Add a unique policy name').fill(policyName);

        const attributeDropdown = teamSettings.container.locator('select').first();
        await attributeDropdown.selectOption('Department');
        const operatorDropdown = teamSettings.container.locator('select').nth(1);
        await operatorDropdown.selectOption('==');
        const valueInput = teamSettings.container.locator('.table-editor input[type="text"]').last();
        await valueInput.fill('Engineering');

        // # Save via SaveChangesPanel
        await teamSettings.container.getByRole('button', {name: 'Save'}).click();
        await page.waitForLoadState('networkidle');

        // # Navigate back to list
        await teamSettings.container.locator('.TeamPolicyEditor__back-btn').click();

        // * Policy appears in list
        await expect(teamSettings.container.getByText(policyName)).toBeVisible();

        await teamSettings.close();
    });
});
