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
    setUserAttribute,
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
        await expect(teamSettings.container.locator('#input_policyName')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_2 Team Admin creates a new policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create private channel and team admin with Department=Engineering
        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

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
        await teamSettings.container.locator('#input_policyName').fill(policyName);

        // # Add a rule row and fill in a value
        // Add a rule: click Add attribute, dismiss the auto-opened menu, fill value
        const addAttrBtn = teamSettings.container.getByRole('button', {name: /Add attribute/});
        await expect(addAttrBtn).toBeEnabled({timeout: 10000});
        await addAttrBtn.click();
        await page.waitForTimeout(500);

        // The attribute selector menu auto-opens as a MUI popover — dismiss it by clicking backdrop
        const backdrop = page.locator('.MuiPopover-root .MuiBackdrop-root');
        if (await backdrop.isVisible({timeout: 2000})) {
            await backdrop.click();
            await page.waitForTimeout(500);
        }

        // Fill value in the simple input (text-type attribute renders direct input)
        const valueInput = teamSettings.container.locator('.values-editor__simple-input').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill('Engineering');

        // # Add channel via channel selector
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});
        await channelModal.locator('.more-modal__row').filter({hasText: channel.display_name}).click();
        await channelModal.getByRole('button', {name: 'Add'}).click();

        // # Save via SaveChangesPanel
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // # Confirm in PolicyConfirmationModal
        await page.locator('.TeamPolicyConfirmationModal').waitFor();
        await page.getByRole('button', {name: /Apply policy/}).click();
        await page.waitForLoadState('networkidle');

        // * Auto-navigated back to list, policy name visible
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
        await expect(teamSettings.container.locator('#input_policyName')).toHaveValue(policy.name);

        // # Modify name
        const newName = `TA Updated ${Date.now()}`;
        await teamSettings.container.locator('#input_policyName').clear();
        await teamSettings.container.locator('#input_policyName').fill(newName);

        // # Save via SaveChangesPanel
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // # Confirm in PolicyConfirmationModal (policy has channels, so modal appears)
        await page.locator('.TeamPolicyConfirmationModal').waitFor();
        await page.getByRole('button', {name: /Apply policy/}).click();
        await page.waitForLoadState('networkidle');

        // * Auto-navigated back to list, updated name visible
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
        await expect(teamSettings.container.locator('#input_policyName')).toHaveValue(policy.name);

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
        await teamSettings.container.locator('#input_policyName').clear();
        await teamSettings.container.locator('#input_policyName').fill('Changed Name');

        // # Click Undo in SaveChangesPanel
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__cancel-btn"]').click();

        // * Name reverted to original
        await expect(teamSettings.container.locator('#input_policyName')).toHaveValue(policy.name);

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
        await page.waitForLoadState('networkidle');

        // * Back to list, policy removed
        await expect(teamSettings.container.getByText(policy.name)).not.toBeVisible();

        await teamSettings.close();
    });

    // Delete action is hidden in the team settings three-dot menu (all listed policies have channels).

    test('MM-67594_8 Save without name shows validation error', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open create editor, add rule + channel but leave name empty
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        // Add a rule: click Add attribute, dismiss the auto-opened menu, fill value
        const addAttrBtn = teamSettings.container.getByRole('button', {name: /Add attribute/});
        await expect(addAttrBtn).toBeEnabled({timeout: 10000});
        await addAttrBtn.click();
        await page.waitForTimeout(500);

        // The attribute selector menu auto-opens as a MUI popover — dismiss it by clicking backdrop
        const backdrop = page.locator('.MuiPopover-root .MuiBackdrop-root');
        if (await backdrop.isVisible({timeout: 2000})) {
            await backdrop.click();
            await page.waitForTimeout(500);
        }

        // Fill value in the simple input (text-type attribute renders direct input)
        const valueInput = teamSettings.container.locator('.values-editor__simple-input').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill('Engineering');
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});
        await channelModal.locator('.more-modal__row').filter({hasText: channel.display_name}).click();
        await channelModal.getByRole('button', {name: 'Add'}).click();

        // # Click Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Error state shown in SaveChangesPanel (name required)
        await expect(teamSettings.container.locator('.SaveChangesPanel.error')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_10 Save without channels shows validation error', async ({pw}) => {
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

        // # Open create editor, add name + rule but no channels
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await teamSettings.container.locator('#input_policyName').fill(`No Channels ${Date.now()}`);
        // Add a rule: click Add attribute, dismiss the auto-opened menu, fill value
        const addAttrBtn = teamSettings.container.getByRole('button', {name: /Add attribute/});
        await expect(addAttrBtn).toBeEnabled({timeout: 10000});
        await addAttrBtn.click();
        await page.waitForTimeout(500);

        // The attribute selector menu auto-opens as a MUI popover — dismiss it by clicking backdrop
        const backdrop = page.locator('.MuiPopover-root .MuiBackdrop-root');
        if (await backdrop.isVisible({timeout: 2000})) {
            await backdrop.click();
            await page.waitForTimeout(500);
        }

        // Fill value in the simple input (text-type attribute renders direct input)
        const valueInput = teamSettings.container.locator('.values-editor__simple-input').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill('Engineering');

        // # Click Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Error state shown in SaveChangesPanel (channels required)
        await expect(teamSettings.container.locator('.SaveChangesPanel.error')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_11 Delete button disabled when policy has channels', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA HasChannels ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open editor
        await teamSettings.container.getByText(policy.name).click();
        await page.waitForLoadState('networkidle');

        // * Delete button is disabled (policy has channels)
        const deleteBtn = teamSettings.container
            .locator('.TeamPolicyEditor__section--delete button')
            .filter({hasText: 'Delete'});
        await expect(deleteBtn).toBeDisabled();

        await teamSettings.close();
    });

    test('MM-67594_12 Success message shown after creating policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Create policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await teamSettings.container.locator('#input_policyName').fill(`Toast Test ${Date.now()}`);
        // Add a rule: click Add attribute, dismiss the auto-opened menu, fill value
        const addAttrBtn = teamSettings.container.getByRole('button', {name: /Add attribute/});
        await expect(addAttrBtn).toBeEnabled({timeout: 10000});
        await addAttrBtn.click();
        await page.waitForTimeout(500);

        // The attribute selector menu auto-opens as a MUI popover — dismiss it by clicking backdrop
        const backdrop = page.locator('.MuiPopover-root .MuiBackdrop-root');
        if (await backdrop.isVisible({timeout: 2000})) {
            await backdrop.click();
            await page.waitForTimeout(500);
        }

        // Fill value in the simple input (text-type attribute renders direct input)
        const valueInput = teamSettings.container.locator('.values-editor__simple-input').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill('Engineering');
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});
        await channelModal.locator('.more-modal__row').filter({hasText: channel.display_name}).click();
        await channelModal.getByRole('button', {name: 'Add'}).click();

        // # Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();
        await page.locator('.TeamPolicyConfirmationModal').waitFor();
        await page.getByRole('button', {name: /Apply policy/}).click();
        await page.waitForLoadState('networkidle');

        // * Success message visible on list view
        await expect(teamSettings.container.locator('.SaveChangesPanel.saved')).toBeVisible();
        await expect(teamSettings.container.getByText('Policy saved')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_13 System Admin can also create policy from Team Settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create private channel and set admin's Department attribute
        const channel = await createPrivateChannel(adminClient, team.id);
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Create policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        const policyName = `SysAdmin Policy ${Date.now()}`;
        await teamSettings.container.locator('#input_policyName').fill(policyName);

        // # Add a rule row and fill in a value
        // Add a rule: click Add attribute, dismiss the auto-opened menu, fill value
        const addAttrBtn = teamSettings.container.getByRole('button', {name: /Add attribute/});
        await expect(addAttrBtn).toBeEnabled({timeout: 10000});
        await addAttrBtn.click();
        await page.waitForTimeout(500);

        // The attribute selector menu auto-opens as a MUI popover — dismiss it by clicking backdrop
        const backdrop = page.locator('.MuiPopover-root .MuiBackdrop-root');
        if (await backdrop.isVisible({timeout: 2000})) {
            await backdrop.click();
            await page.waitForTimeout(500);
        }

        // Fill value in the simple input (text-type attribute renders direct input)
        const valueInput = teamSettings.container.locator('.values-editor__simple-input').first();
        await valueInput.waitFor({state: 'visible', timeout: 10000});
        await valueInput.fill('Engineering');

        // # Add channel via channel selector
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});
        await channelModal.locator('.more-modal__row').filter({hasText: channel.display_name}).click();
        await channelModal.getByRole('button', {name: 'Add'}).click();

        // # Save via SaveChangesPanel
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // # Confirm in PolicyConfirmationModal
        await page.locator('.TeamPolicyConfirmationModal').waitFor();
        await page.getByRole('button', {name: /Apply policy/}).click();
        await page.waitForLoadState('networkidle');

        // * Auto-navigated back to list, policy appears
        await expect(teamSettings.container.getByText(policyName)).toBeVisible();

        await teamSettings.close();
    });
});
