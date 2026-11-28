// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {Api, settle, expect, newTestPassword, test, duration, Msg, type App} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createParentPolicy,
    assignChannelsToPolicy,
    unassignChannelsFromPolicy,
    createPrivateChannel,
    createTeamAdmin,
    setUserAttribute,
    addRule,
} from './helpers';
import {addChannel, closeTeamSettings, policyRow, policyRows, openAccessPoliciesTab, openTeam} from './surface';

/** Removes the first channel assigned to the policy being edited. */
async function removeFirstChannel(editor: App['teamSettingsModal']['accessPolicies']['editor']) {
    const [first] = await editor.channels.rowList.keys();
    await editor.channels.row(first).removeLink.click();
    await expect(editor.channels.row(first)).toHaveCount(0);
}

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_1 Add policy button opens the editor view', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Click Add policy
        await teamSettings.accessPolicies.addPolicyButton.click();

        // * Editor view shown with back button and name input
        await expect(teamSettings.accessPolicies.editor.backButton).toBeVisible();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-67594_2 Team Admin creates a new policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Create private channel and team admin with Department=Engineering
        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Click Add policy
        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        // # Fill policy name
        const policyName = `TA Policy ${Date.now()}`;
        await teamSettings.accessPolicies.editor.name.container.fill(policyName);
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policyName);

        // # Add a rule row and fill in a value
        await addRule(teamSettings.accessPolicies.editor.rules, department, 'Engineering');

        // # Add channel via channel selector
        await addChannel(app, teamSettings.accessPolicies.editor, channel);

        // * Confirm the channel appears in the editor list before saving
        await expect(teamSettings.accessPolicies.editor.channels.row(channel.id)).toContainText(channel.display_name);

        // Enable attribute-based access before saving so policy validation can complete.
        await enableABACConfig(adminClient);

        // # Save via SaveChangesPanel — wait for button to be enabled (form fully dirty).
        const saveBtn = teamSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: duration.half_min});
        await saveBtn.click();
        await expect(teamSettings.accessPolicies.editor.policyChangeModal.container).toBeVisible();

        // Keep attribute-based access enabled before confirming the new policy.
        await enableABACConfig(adminClient);

        // # Confirm in PolicyConfirmationModal
        const confirm = teamSettings.accessPolicies.editor.policyChangeModal;
        await expect(confirm.confirmButton).toHaveText(/Apply policy/);
        await settle(confirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();

        // * Auto-navigated back to list, policy name visible.
        await expect(await policyRow(teamSettings, policyName)).toBeVisible({timeout: duration.half_min});

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Click policy row
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();

        // * Editor shown with pre-populated name
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policy.name);

        // # Modify name
        const newName = `TA Updated ${Date.now()}`;
        await teamSettings.accessPolicies.editor.name.container.clear();
        await teamSettings.accessPolicies.editor.name.container.fill(newName);
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(newName);

        // # Save via SaveChangesPanel (name-only change skips confirmation modal)
        await settle(teamSettings.savePanel.saveButton, {wait: Api.CreateAccessControlPolicy}).click();

        // * Auto-navigated back to list, updated name visible
        await expect(await policyRow(teamSettings, newName)).toBeVisible();

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Click three-dot menu then Edit
        const policyItem = teamSettings.accessPolicies.policies.row(policy.id);
        await policyItem.openMenuButton.click();
        const menu = app.accessPolicyRowMenu;
        await expect(menu.editMenuItem).toBeVisible();
        await menu.editMenuItem.click();

        // * Editor shown with pre-populated name
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policy.name);

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open editor and modify name
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        await teamSettings.accessPolicies.editor.name.container.clear();
        await teamSettings.accessPolicies.editor.name.container.fill('Changed Name');
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue('Changed Name');

        // # Click Undo in SaveChangesPanel
        await teamSettings.savePanel.cancelButton.click();

        // * Name reverted to original
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policy.name);

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open editor and make a change so the SaveChangesPanel is shown
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();
        await teamSettings.accessPolicies.editor.name.container.fill('Changed Name');
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue('Changed Name');

        // # Click the back button — sets navigation intent but stays in editor because of unsaved changes
        await teamSettings.accessPolicies.editor.backButton.click();
        await expect(teamSettings.savePanel).toHaveClass(/error/);

        // # Click Undo — should revert changes AND navigate back to the list.
        // This validates the fix for the bug where the navigation intent expired after 3 seconds,
        // causing Undo to revert changes but leave the user stranded in the editor.
        await teamSettings.savePanel.cancelButton.click();

        // * List view restored (back navigation happened)
        await expect(teamSettings.accessPolicies.addPolicyButton).toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-67594_6 Back button returns to list', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open editor then click back
        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();
        await teamSettings.accessPolicies.editor.backButton.click();

        // * List view restored
        await expect(teamSettings.accessPolicies.addPolicyButton).toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-67594_7 Delete policy from editor view', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Delete Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open editor
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        // # Remove the channel to enable delete (click Remove link in channel list)
        await removeFirstChannel(teamSettings.accessPolicies.editor);

        // # Click Delete in the delete section
        await teamSettings.accessPolicies.editor.deleteButton.click();
        const deleteModal = teamSettings.accessPolicies.editor.deleteModal;

        // # Confirm in delete confirmation modal
        await expect(deleteModal.confirmButton).toHaveText('Delete');
        await settle(deleteModal.confirmButton, {wait: Api.DeleteAccessControlPolicy}).click();

        // * Back to list, policy removed
        await expect(policyRows(teamSettings, policy.name)).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    // Delete action is hidden in the team settings three-dot menu (all listed policies have channels).

    test('MM-67594_8 Save without name shows validation error', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open create editor, add rule + channel but leave name empty
        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();
        await addRule(teamSettings.accessPolicies.editor.rules, department, 'Engineering');
        await addChannel(app, teamSettings.accessPolicies.editor, channel);

        // # Click Save
        await teamSettings.savePanel.saveButton.click();

        // * Error state shown in SaveChangesPanel (name required)
        await expect(teamSettings.savePanel).toHaveClass(/error/);

        await closeTeamSettings(teamSettings);
    });

    test('MM-67594_10 Save without channels shows validation error', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open create editor, add name + rule but no channels
        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();
        const policyName = `No Channels ${Date.now()}`;
        await teamSettings.accessPolicies.editor.name.container.fill(policyName);
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policyName);
        await addRule(teamSettings.accessPolicies.editor.rules, department, 'Engineering');

        // # Click Save
        await teamSettings.savePanel.saveButton.click();

        // * Error state shown in SaveChangesPanel (channels required)
        await expect(teamSettings.savePanel).toHaveClass(/error/);

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open editor
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        // * Delete button is disabled (policy has channels)
        await expect(teamSettings.accessPolicies.editor.deleteButton).toBeDisabled();

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open the existing policy editor
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        // # Open Add channels modal
        await teamSettings.accessPolicies.editor.addChannelsButton.click();
        const selector = app.channelSelectorModal;
        await expect(selector.container).toBeVisible();
        const {results} = selector.channels;
        await expect(results.channelList).not.toHaveKeyCount(0);

        // * Already assigned channel is NOT shown in the modal
        await expect(results.channel(assignedChannel)).toHaveCount(0);

        // * Unassigned channel IS shown in the modal
        await expect(results.channel(unassignedChannel)).toBeVisible();

        await selector.closeButton.click();
        await expect(results.channelList.locator).toHaveCount(0);
        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Edit policy name (name-only change — no confirmation modal)
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policy.name)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        await teamSettings.accessPolicies.editor.name.container.clear();
        const updatedName = `Updated ${Date.now()}`;
        await teamSettings.accessPolicies.editor.name.container.fill(updatedName);
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(updatedName);

        // # Save
        await settle(teamSettings.savePanel.saveButton, {wait: Api.CreateAccessControlPolicy}).click();

        // * Success message visible on list view
        await expect(teamSettings.savePanel).toHaveClass(/saved/);
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.team_settings.policy_editor.policy_updated);

        await closeTeamSettings(teamSettings);
    });

    test('MM-67594_13 System Admin can also create policy from Team Settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
        });
        const department = await ensureDepartmentAttribute(adminClient);

        // # Create private channel and set admin's Department attribute
        const channel = await createPrivateChannel(adminClient, team.id);
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        // # Navigate
        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Create policy
        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        const policyName = `SysAdmin Policy ${Date.now()}`;
        await teamSettings.accessPolicies.editor.name.container.fill(policyName);
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policyName);

        // # Add a rule row and fill in a value
        await addRule(teamSettings.accessPolicies.editor.rules, department, 'Engineering');

        // # Add channel via channel selector
        await addChannel(app, teamSettings.accessPolicies.editor, channel);

        // * Confirm the channel appears in the editor list before saving
        await expect(teamSettings.accessPolicies.editor.channels.row(channel.id)).toContainText(channel.display_name);

        // # Save via SaveChangesPanel — wait for button to be enabled (form fully dirty)
        const saveBtn = teamSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled();
        // Enable attribute-based access before saving so policy validation can complete.
        await enableABACConfig(adminClient);
        await saveBtn.click();
        await expect(teamSettings.accessPolicies.editor.policyChangeModal.container).toBeVisible();

        // Keep attribute-based access enabled before confirming the new policy.
        await enableABACConfig(adminClient);

        // # Confirm in PolicyConfirmationModal
        const confirm = teamSettings.accessPolicies.editor.policyChangeModal;
        await expect(confirm.confirmButton).toHaveText(/Apply policy/);
        await settle(confirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();

        // * Auto-navigated back to list, policy appears
        await expect(await policyRow(teamSettings, policyName)).toBeVisible();

        await closeTeamSettings(teamSettings);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // initSetup() on another worker can disable ABAC — without it the sync footer never completes reliably.
        await enableABACConfig(adminClient);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
        });

        // * Footer visible with "Sync now" action
        const {syncStatus} = teamSettings.accessPolicies;
        await expect(syncStatus).toBeVisible();
        await expect(syncStatus.syncNowButton).toBeVisible();

        // # Click Sync now
        await settle(teamSettings.accessPolicies.syncStatus.syncNowButton, {wait: Api.CreateJob}).click();

        // * Syncing state appears
        await expect(teamSettings.accessPolicies.syncStatus.syncingText).toBeVisible();

        // * Wait for sync to complete and "Sync now" to reappear
        await expect(teamSettings.accessPolicies.syncStatus.syncNowButton).toBeVisible({
            timeout: duration.two_min,
        });

        // * Status updates to "Last synced just now" confirming a fresh sync completed
        await expect(teamSettings.accessPolicies.syncStatus.timeText).toHaveText(/Last synced just now/, {
            timeout: duration.half_min,
        });

        await closeTeamSettings(teamSettings);
    });

    test('MM-67967_2 System admin can trigger sync from team settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
        });
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `SysAdmin Sync ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // * Footer visible with "Sync now" action
        await expect(teamSettings.accessPolicies.syncStatus.syncNowButton).toBeVisible({
            timeout: duration.half_min,
        });

        // # Click Sync now
        await settle(teamSettings.accessPolicies.syncStatus.syncNowButton, {wait: Api.CreateJob}).click();

        // * Wait for sync to complete and "Sync now" to reappear
        await expect(teamSettings.accessPolicies.syncStatus.syncNowButton).toBeVisible({
            timeout: duration.half_min,
        });

        // * Status updates to "Last synced just now" confirming a fresh sync completed
        await expect(teamSettings.accessPolicies.syncStatus.timeText).toHaveText(/Last synced just now/);

        await closeTeamSettings(teamSettings);
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
        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // * Policy is visible
        await expect(await policyRow(teamSettings, policyName)).toBeVisible();

        // # Open editor by clicking policy row
        // The DataGrid name cell handles navigation without an interactive role.
        await (await policyRow(teamSettings, policyName)).cell('name').click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        // # Remove the channel to enable delete
        await removeFirstChannel(teamSettings.accessPolicies.editor);

        // # Click Delete in the delete section
        await expect(teamSettings.accessPolicies.editor.deleteButton).toBeEnabled();
        await teamSettings.accessPolicies.editor.deleteButton.click();
        const deleteModal = teamSettings.accessPolicies.editor.deleteModal;

        // # Confirm deletion
        await expect(deleteModal.confirmButton).toHaveText('Delete');
        await settle(deleteModal.confirmButton, {wait: Api.DeleteAccessControlPolicy}).click();

        // * Back to list, policy is removed
        await expect(policyRows(teamSettings, policyName)).not.toBeVisible();

        await closeTeamSettings(teamSettings);
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
        const app = await openTeam(pw, teamAdmin, team);

        // # Step 1: Team admin can see the policy (all channels in their team)
        const teamSettings = await openAccessPoliciesTab(app);

        await expect(await policyRow(teamSettings, policyName)).toBeVisible();
        await closeTeamSettings(teamSettings);

        // # Step 2: System admin adds a channel from team B (cross-team)
        await assignChannelsToPolicy(adminClient, policy.id, [channelB.id]);

        // # Team admin reopens team settings — policy should NOT be visible (cross-team)
        const teamSettings2 = await openAccessPoliciesTab(app);

        await expect(policyRows(teamSettings2, policyName)).not.toBeVisible();
        await closeTeamSettings(teamSettings2);

        // # Step 3: System admin removes team B channel (back to single-team)
        await unassignChannelsFromPolicy(adminClient, policy.id, [channelB.id]);

        // # Team admin reopens team settings — policy should be visible again
        const teamSettings3 = await openAccessPoliciesTab(app);

        await expect(await policyRow(teamSettings3, policyName)).toBeVisible();

        await closeTeamSettings(teamSettings3);
    });

    test.fixme('MM-67594_14 Add channels modal shows only private member channels even when team has >50 public channels', async ({
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
            const pub = await adminClient.createPublicChannel(team.id);
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

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        // # Open the policy editor and click Add channels
        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();
        await teamSettings.accessPolicies.editor.addChannelsButton.click();
        const selector = app.channelSelectorModal;
        await expect(selector.container).toBeVisible();
        const {results} = selector.channels;
        await expect(results.channelList).not.toHaveKeyCount(0);

        // * Both private channels appear despite 55 public channels exceeding the cap
        await expect(results.channel(privateChannel1)).toBeVisible();
        await expect(results.channel(privateChannel2)).toBeVisible();

        // * Group-constrained channel does not appear
        await expect(results.channel(gcChannel)).toHaveCount(0);

        await selector.closeButton.click();
        await expect(results.channelList.locator).toHaveCount(0);
        await closeTeamSettings(teamSettings);
    });

    test('MM-67920_sync_1 Sync job created on policy save adds matching user to channel', async ({pw}) => {
        /**
         * Regression test for the bug where a team admin creating a policy and selecting
         * "Apply policy" (add users immediately) would receive a 403 because the job
         * creation endpoint required manage_system when policy_id was present.
         *
         * Verifies the full end-to-end fix: policy creation → sync job creation → user added.
         */
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Create channel — target user should be added here by the sync
        const channel = await createPrivateChannel(adminClient, team.id);

        // # Create team admin with Department=Engineering and add to channel (self-inclusion check)
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await adminClient.addToChannel(teamAdmin.id, channel.id);

        // # Create target user: team member with Department=Engineering but NOT in channel yet
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        const targetUser = await adminClient.createUser(
            {
                email: `target-${id}@sample.mattermost.com`,
                username: `target${id}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        await adminClient.addToTeam(team.id, targetUser.id);
        await setUserAttribute(adminClient, targetUser.id, 'Department', 'Engineering');

        // # Log in as team admin and open policy editor
        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessPoliciesTab(app);

        await teamSettings.accessPolicies.addPolicyButton.click();
        await expect(teamSettings.accessPolicies.editor.name.container).toBeVisible();

        // # Fill policy name and add attribute rule
        const policyName = `Sync Bug Fix ${Date.now()}`;
        await teamSettings.accessPolicies.editor.name.container.fill(policyName);
        await expect(teamSettings.accessPolicies.editor.name.container).toHaveValue(policyName);
        await addRule(teamSettings.accessPolicies.editor.rules, department, 'Engineering');

        // # Add channel
        await addChannel(app, teamSettings.accessPolicies.editor, channel);
        await expect(teamSettings.accessPolicies.editor.channels.row(channel.id)).toContainText(channel.display_name);

        // # Enable Auto-add members for the channel so the sync job adds matching users
        await teamSettings.accessPolicies.editor.channels.row(channel.id).autoAddCheckbox.set(true);
        await expect(teamSettings.accessPolicies.editor.channels.row(channel.id).autoAddCheckbox).toBeChecked();

        // # Save — triggers confirmation modal
        const saveBtn = teamSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: duration.half_min});
        await saveBtn.click();
        await expect(teamSettings.accessPolicies.editor.policyChangeModal.container).toBeVisible();

        // # Confirm "Apply policy" (add users immediately)
        const confirm = teamSettings.accessPolicies.editor.policyChangeModal;
        await expect(confirm.confirmButton).toHaveText(/Apply policy/);
        await settle(confirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();

        // * Navigate back to policy list — confirms save succeeded (no 403 on job creation)
        await expect(await policyRow(teamSettings, policyName)).toBeVisible({timeout: duration.half_min});

        // * Target user is added to the channel by the sync job
        await expect
            .poll(async () => (await adminClient.getChannelMembersByIds(channel.id, [targetUser.id])).length, {
                timeout: duration.two_min,
                intervals: [2000, 4000, 6000],
            })
            .toBe(1);

        await closeTeamSettings(teamSettings);
    });
});
