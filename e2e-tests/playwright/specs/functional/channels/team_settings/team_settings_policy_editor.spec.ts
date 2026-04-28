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
    unassignChannelsFromPolicy,
    createPrivateChannel,
    createPublicChannel,
    createTeamAdmin,
    setUserAttribute,
    addAttributeRule,
    addChannelToPolicy,
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
        await channelsPage.toBeVisible();

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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Click three-dot menu then Edit
        const menuButton = teamSettings.container.locator(`button[id="policy-menu-${policy.id}"]`);
        await menuButton.click();
        await page.getByRole('menuitem', {name: 'Edit'}).click();

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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA BackUndo ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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

    test('MM-67594_6 Back button returns to list', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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

    test('MM-67594_8 Save without name shows validation error', async ({pw}) => {
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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open editor
        await teamSettings.container.getByText(policy.name).click();

        // * Delete button is disabled (policy has channels)
        const deleteBtn = teamSettings.container
            .locator('.TeamPolicyEditor__section--delete button')
            .filter({hasText: 'Delete'});
        await expect(deleteBtn).toBeDisabled();

        await teamSettings.close();
    });

    test('MM-67594_11b Add channels modal excludes channels already assigned to the policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create two channels and assign one to the policy via API
        const assignedChannel = await createPrivateChannel(adminClient, team.id);
        const unassignedChannel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Duplicate Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [assignedChannel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, assignedChannel.id);
        await adminClient.addToChannel(teamAdmin.id, unassignedChannel.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open the existing policy editor
        await teamSettings.container.getByText(policy.name).click();
        await expect(teamSettings.container.locator('#input_policyName')).toBeVisible({timeout: 10000});

        // # Open Add channels modal
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});

        // * Already assigned channel is NOT shown in the modal
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: assignedChannel.display_name}),
        ).not.toBeVisible();

        // * Unassigned channel IS shown in the modal
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: unassignedChannel.display_name}),
        ).toBeVisible();

        await page.keyboard.press('Escape');
        await teamSettings.close();
    });

    test('MM-67594_12 Success message shown after saving policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Toast Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Edit policy name (name-only change — no confirmation modal)
        await teamSettings.container.getByText(policy.name).click();

        await teamSettings.container.locator('#input_policyName').clear();
        await teamSettings.container.locator('#input_policyName').fill(`Updated ${Date.now()}`);

        // # Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Success message visible on list view
        await expect(teamSettings.container.locator('.SaveChangesPanel.saved')).toBeVisible();
        await expect(teamSettings.container.getByText('Policy updated')).toBeVisible();

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
        // # Navigate and wait for all API calls to settle (custom profile attributes
        // must be fetched before the self-inclusion check can validate the admin's Department)
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Create policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        const policyName = `SysAdmin Policy ${Date.now()}`;
        await teamSettings.container.locator('#input_policyName').fill(policyName);

        // # Add a rule row and fill in a value
        await addAttributeRule(teamSettings.container, page, 'Engineering');

        // # Add channel via channel selector
        await addChannelToPolicy(teamSettings.container, page, channel.display_name);

        // * Confirm the channel appears in the editor list before saving
        await expect(teamSettings.container.getByText(channel.display_name)).toBeVisible({timeout: 10000});

        // # Save via SaveChangesPanel — wait for button to be enabled (form fully dirty)
        const saveBtn = teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // # Confirm in PolicyConfirmationModal
        await page.locator('.TeamPolicyConfirmationModal').waitFor({timeout: 30000});
        await page.getByRole('button', {name: /Apply policy/}).click();

        // * Auto-navigated back to list, policy appears
        await expect(teamSettings.container.getByText(policyName)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67967_1 Team admin can trigger sync and see updated status', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Sync Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Footer visible with "Sync now" action
        const footer = teamSettings.container.locator('.SyncStatusFooter');
        await expect(footer).toBeVisible({timeout: 10000});
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible();

        // # Click Sync now
        await teamSettings.container.getByText(/Sync now/).click();

        // * Syncing state appears
        await expect(teamSettings.container.getByText(/Syncing/)).toBeVisible({timeout: 5000});

        // * Wait for sync to complete and "Sync now" to reappear
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible({timeout: 30000});

        // * Status updates to "Last synced just now" confirming a fresh sync completed
        await expect(teamSettings.container.getByText(/Last synced just now/)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67967_2 System admin can trigger sync from team settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `SysAdmin Sync ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Footer visible with "Sync now" action
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible({timeout: 15000});

        // # Click Sync now
        await teamSettings.container.getByText(/Sync now/).click();

        // * Wait for sync to complete and "Sync now" to reappear
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible({timeout: 30000});

        // * Status updates to "Last synced just now" confirming a fresh sync completed
        await expect(teamSettings.container.getByText(/Last synced just now/)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_1 Team admin can delete policy after removing all channels', async ({pw}) => {
        // Scenario: Policy created via API → team admin opens editor → removes channel → deletes.
        // Validates that the scope field persists team ownership through channel removal.
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

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
        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

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

    test('MM-67594_2 System admin cross-team channel changes toggle team admin visibility', async ({pw}) => {
        // Scenario: System admin creates policy with team A channels → team admin A sees it →
        // system admin adds team B channel (cross-team) → team admin A no longer sees it →
        // system admin removes team B channel → team admin A sees it again.
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a second team
        const otherTeam = await adminClient.createTeam({
            name: `other-${Date.now()}`,
            display_name: 'Other Team',
            type: 'O',
        } as any);

        // # Create team admin for team A with Department attribute
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # Create private channels in both teams
        const channelA = await createPrivateChannel(adminClient, team.id);
        const channelB = await createPrivateChannel(adminClient, otherTeam.id);
        await adminClient.addToChannel(teamAdmin.id, channelA.id);

        // # System admin creates policy and assigns team A channel
        const policyName = `Cross-Team Scope Test ${Date.now()}`;
        const policy = await createParentPolicy(adminClient, policyName);
        await assignChannelsToPolicy(adminClient, policy.id, [channelA.id]);

        // # Team admin logs in and opens team settings
        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Step 1: Team admin can see the policy (all channels in their team)
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        await expect(teamSettings.container.getByText(policyName)).toBeVisible({timeout: 10000});
        await teamSettings.close();

        // # Step 2: System admin adds a channel from team B (cross-team)
        await assignChannelsToPolicy(adminClient, policy.id, [channelB.id]);

        // # Team admin reopens team settings — policy should NOT be visible (cross-team)
        const teamSettings2 = await channelsPage.openTeamSettings();
        await teamSettings2.openAccessPoliciesTab();

        await expect(teamSettings2.container.getByText(policyName)).not.toBeVisible({timeout: 10000});
        await teamSettings2.close();

        // # Step 3: System admin removes team B channel (back to single-team)
        await unassignChannelsFromPolicy(adminClient, policy.id, [channelB.id]);

        // # Team admin reopens team settings — policy should be visible again
        const teamSettings3 = await channelsPage.openTeamSettings();
        await teamSettings3.openAccessPoliciesTab();

        await expect(teamSettings3.container.getByText(policyName)).toBeVisible({timeout: 10000});

        await teamSettings3.close();
    });

    test('MM-67594_14 Add channels modal shows only private member channels even when team has >50 public channels', async ({
        pw,
    }) => {
        // Regression: the non-sysConsole fast path previously called AutocompleteChannelsForTeam
        // which ignored the private=true filter and returned a mixed set capped at 50.
        // With >50 public channels, private channels were cut off before client-side filtering.
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # Create 55 public channels — more than the 50-result autocomplete cap
        for (let i = 0; i < 55; i++) {
            const pub = await createPublicChannel(adminClient, team.id);
            await adminClient.addToChannel(teamAdmin.id, pub.id);
        }

        // # Create 2 private channels the team admin is a member of
        const privateChannel1 = await createPrivateChannel(adminClient, team.id);
        const privateChannel2 = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, privateChannel1.id);
        await adminClient.addToChannel(teamAdmin.id, privateChannel2.id);

        // # Create a private channel, add the team admin, then make it group-constrained.
        // Membership must be established before the constraint is set — the API rejects
        // addToChannel on an already-constrained channel.
        const gcChannel = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, gcChannel.id);
        await adminClient.patchChannel(gcChannel.id, {group_constrained: true} as any);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Open the policy editor and click Add channels
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await expect(teamSettings.container.locator('#input_policyName')).toBeVisible({timeout: 10000});
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();

        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});

        // * Both private channels appear despite 55 public channels exceeding the cap
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: privateChannel1.display_name}),
        ).toBeVisible();
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: privateChannel2.display_name}),
        ).toBeVisible();

        // * No public channels appear in the modal
        const rows = channelModal.locator('.more-modal__row');
        const count = await rows.count();
        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            const icon = row.locator('.icon-globe');
            await expect(icon).not.toBeVisible();
        }

        // * Group-constrained channel does not appear
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: gcChannel.display_name}),
        ).not.toBeVisible();

        await page.keyboard.press('Escape');
        await teamSettings.close();
    });
});
