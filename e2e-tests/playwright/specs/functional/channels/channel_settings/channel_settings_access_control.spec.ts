// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Membership Policy tab (access_rules) in Channel Settings Modal
 * @reference MM-67326 — public and private channels can carry ABAC membership policies
 */

import {expect, test, closeChannelSettings, App, Api, settle, Msg} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createParentPolicy,
    assignChannelsToPolicy,
    createPrivateChannel,
    createGroupConstrainedPrivateChannel,
    setUserAttribute,
    addAttributeRule,
    createTeamAdmin,
    waitForAttributeViewToInclude,
} from '../team_settings/helpers';

import {waitForJobCompletion} from './helpers';

/** Unique CPA value so only users this test sets match the rule (avoids clashing with leftover Engineering users on the server). */
function uniqueDepartmentValue(testId: string): string {
    return `E2E-${testId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

test.describe('Channel Settings Modal - Access Control Tab', () => {
    test('MM-67326_c1 Access Control tab visible for admin on private channel with ABAC enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // * Access Control tab is visible
        await expect(channelSettings.tabs.tab('access_rules').locator).toBeVisible();

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c2 Access Control tab hidden when ABAC disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();

        // Explicitly disable ABAC. initSetup() resets to the default config which has
        // EnableAttributeBasedAccessControl:true (required by the ABAC test suite baseline),
        // so we must patch it off. Concurrent tests in other files also call enableABACConfig()
        // and may race to re-enable it before this modal opens.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        });

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        // Disable ABAC once more right before the modal opens to shrink the race window.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        });
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // * Access Control tab is NOT visible
        await expect(channelSettings.tabs.tab('access_rules').locator).not.toBeVisible();

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c3 Membership Policy tab visible for admin on public channel with ABAC enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const channel = await adminClient.createPublicChannel(team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // * Membership Policy tab is visible on public channels when ABAC is enabled (not group-constrained / not default)
        await expect(channelSettings.tabs.tab('access_rules').locator).toBeVisible();

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c4 Access Control tab hidden for group-constrained channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const channel = await createGroupConstrainedPrivateChannel(adminClient, team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // * Access Control tab is NOT visible for group-constrained channel
        await expect(channelSettings.tabs.tab('access_rules').locator).not.toBeVisible();

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c5 Auto-add checkbox disabled when no rules defined', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // * Auto-add checkbox is disabled — no rules or system policies defined
        const autoAddCheckbox = channelSettings.accessRules.autoSyncCheckbox;
        await expect(autoAddCheckbox).toBeDisabled();

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c6 System policy banner visible when parent policy is applied to channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        // # Create a parent (team-level) policy and assign this channel to it
        const policy = await createParentPolicy(adminClient, `Parent Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // * System policy banner is visible
        await expect(channelSettings.accessRules.systemPolicies).toBeVisible({timeout: 10000});

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c7 Add attribute rule and save without auto-add', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Admin's Department must satisfy the rule (self-exclusion check)
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add an attribute rule: Department == Engineering
        await addAttributeRule(tab.locator, page, 'Engineering');

        // # Save (auto-add remains off — no confirmation modal for first-time rules with no member changes)
        const saveBtn = channelSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await settle(saveBtn, {wait: Api.CreateAccessControlPolicy}).click();

        // * SaveChangesPanel disappears — rules were saved
        await expect(saveBtn).not.toBeVisible({timeout: 15000});
    });

    test('MM-67326_c8 Auto-add checkbox becomes enabled after adding an attribute rule', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // * Checkbox starts disabled — no rules or system policies
        const autoAddCheckbox = channelSettings.accessRules.autoSyncCheckbox;
        await expect(autoAddCheckbox).toBeDisabled();

        // # Add an attribute rule
        await addAttributeRule(tab.locator, page, 'Engineering');

        // * Checkbox is now enabled
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c9 Auto-add members: user matching rule is added to channel via sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const departmentValue = uniqueDepartmentValue('c9');

        // # Admin's Department satisfies the rule (self-exclusion check passes)
        await setUserAttribute(adminClient, adminUser.id, 'Department', departmentValue);

        // # Private channel — admin is the creator and only member
        const channel = await createPrivateChannel(adminClient, team.id);

        // # Target user: in the team, same Department, NOT yet in the channel
        const targetUser = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, targetUser.id, 'Department', departmentValue);

        // Save will run validateExpressionAgainstRequester and calculateMembershipChanges,
        // both of which query the Postgres materialized AttributeView. The enterprise
        // access-control service gates view refreshes to once per ~30s, so the brand-new
        // unique CPA value above is not yet visible to CEL queries. Without this wait,
        // Save hits the self-exclusion modal (admin appears unmatched against the rule
        // they just satisfied via the API) and the confirmation modal never opens.
        await waitForAttributeViewToInclude(adminClient, `user.attributes.Department == "${departmentValue}"`, [
            adminUser.id,
            targetUser.id,
        ]);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add attribute rule (unique value → preview lists only targetUser to add)
        await addAttributeRule(tab.locator, page, departmentValue);

        // * Unsaved changes must be committed before save; otherwise handleSave can skip the confirmation path
        await expect(channelSettings.savePanel.saveButton).toBeVisible({timeout: 15000});

        // # Enable auto-add members
        const autoAddCheckbox = channelSettings.accessRules.autoSyncCheckbox;
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});
        await autoAddCheckbox.check();
        await expect(autoAddCheckbox).toBeChecked();

        // # Save — confirmation modal appears because targetUser will be added
        const saveBtn = channelSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // # Confirm in the membership changes modal
        const confirmModal = new App(page).channelAccessRulesConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 30000});
        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 15000});

        // * Poll until target user appears as a channel member (sync job runs asynchronously)
        await expect
            .poll(
                () =>
                    adminClient.getChannelMember(channel.id, targetUser.id).then(
                        () => true,
                        () => false,
                    ),
                {timeout: 30000},
            )
            .toBe(true);

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c10 Self-exclusion validation prevents saving rule that excludes current user', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Admin is in Engineering — rule requires Sales, so admin would be excluded
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add a rule that excludes the admin: Department == Sales
        await addAttributeRule(tab.locator, page, 'Sales');

        // # Attempt to save
        const saveBtn = channelSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // * Self-exclusion error modal appears
        const selfExclusionModal = channelSettings.accessRules.selfExclusionModal;
        await expect(selfExclusionModal).toBeVisible({timeout: 15000});

        // # Dismiss the modal to go back to editing
        await selfExclusionModal.confirmButton.click();
        await expect(selfExclusionModal).not.toBeVisible();

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c11 Unsaved changes — closing modal without saving keeps it open on first click', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add a rule to create unsaved changes
        await addAttributeRule(tab.locator, page, 'Engineering');

        // * SaveChangesPanel is visible — there are unsaved changes
        await expect(channelSettings.savePanel.saveButton).toBeVisible({timeout: 5000});

        // # First close click — modal stays open (unsaved-changes two-step close)
        await channelSettings.closeButton.click();
        await expect(channelSettings).toBeVisible({timeout: 15000});

        // # Second click — modal closes
        await channelSettings.closeButton.click();
        await expect(channelSettings).not.toBeVisible({timeout: 30000});
    });

    test('MM-67326_c12 View users — Restricted tab shows member count and user when rule removes a channel member', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Admin satisfies the rule
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const channel = await createPrivateChannel(adminClient, team.id);

        // # Add a second member who will NOT satisfy the rule (no Department attribute)
        const memberToRemove = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(memberToRemove.id, channel.id);
        // memberToRemove has no Department set → will not match "Department == Engineering"

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add rule: Department == Engineering (memberToRemove doesn't match → will be removed)
        await addAttributeRule(tab.locator, page, 'Engineering');

        // # Click Save — confirmation modal appears because memberToRemove will be removed
        const saveBtn = channelSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        const confirmModal = new App(page).channelAccessRulesConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 30000});

        // * Summary message shows 0 users added and 1 member removed
        await expect(confirmModal.container).toContainText('remove 1 current channel member');

        // # Click "View users" to open the detailed user list
        await confirmModal.viewUsersButton.click();

        // * "Restricted (1)" tab is visible — one member will be removed
        await expect(confirmModal.restrictedButton).toContainMessage(
            Msg.channel_settings.access_rules.confirm_modal.restricted_tab,
            {count: 1},
            {timeout: 5000},
        );

        // # Switch to the Restricted tab
        await confirmModal.restrictedButton.click();

        // * memberToRemove's username appears in the restricted list
        await expect(confirmModal.container).toContainText(memberToRemove.username, {timeout: 5000});

        // # Cancel — don't actually apply
        await confirmModal.cancelButton.click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c13 View users — Allowed tab shows member count and user when auto-add brings new members', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const departmentValue = uniqueDepartmentValue('c13');

        // # Admin satisfies the rule
        await setUserAttribute(adminClient, adminUser.id, 'Department', departmentValue);

        // # Private channel — admin is the only member
        const channel = await createPrivateChannel(adminClient, team.id);

        // # Target user: in the team, same Department, NOT yet in the channel
        const memberToAdd = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, memberToAdd.id, 'Department', departmentValue);

        // See c9: wait for the materialized AttributeView to surface admin and
        // memberToAdd as matching the freshly-written CPA value before clicking Save.
        await waitForAttributeViewToInclude(adminClient, `user.attributes.Department == "${departmentValue}"`, [
            adminUser.id,
            memberToAdd.id,
        ]);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add rule (unique value → only memberToAdd appears in "to add" with this server data)
        await addAttributeRule(tab.locator, page, departmentValue);
        await expect(channelSettings.savePanel.saveButton).toBeVisible({timeout: 15000});

        // # Enable auto-add so memberToAdd appears in the "to add" list
        const autoAddCheckbox = channelSettings.accessRules.autoSyncCheckbox;
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});
        await autoAddCheckbox.check();
        await expect(autoAddCheckbox).toBeChecked();

        // # Click Save — confirmation modal appears because memberToAdd will be added
        const saveBtn = channelSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        const confirmModal = new App(page).channelAccessRulesConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 30000});

        // * Summary shows 0 members removed (no one in this channel lacks the attribute)
        await expect(confirmModal.container).toContainText('remove 0 current channel members');

        // # Click "View users" to open the detailed user list
        await confirmModal.viewUsersButton.click();

        // * Allowed tab is visible with at least one user (memberToAdd)
        await expect(confirmModal.allowedButton).toBeVisible({
            timeout: 5000,
        });

        // # The Allowed tab is active by default — verify memberToAdd's username is shown (unique Dept avoids other matches)
        await expect(confirmModal.container).toContainText(memberToAdd.username, {timeout: 5000});

        // # Cancel — don't actually apply
        await confirmModal.cancelButton.click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});

        await closeChannelSettings(channelSettings);
    });

    test('MM-67326_c14 Applying access rules removes non-matching member from channel and RHS members', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const departmentValue = uniqueDepartmentValue('c14');

        // # Admin satisfies the rule
        await setUserAttribute(adminClient, adminUser.id, 'Department', departmentValue);

        const channel = await createPrivateChannel(adminClient, team.id);

        // # Existing member does not satisfy the rule and should be removed when it is applied
        const memberToRemove = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, memberToRemove.id, 'Department', `${departmentValue}-other`);
        await adminClient.addToChannel(memberToRemove.id, channel.id);

        // See c9: wait for the materialized AttributeView to surface the admin's
        // freshly-written CPA value before clicking Save.
        await waitForAttributeViewToInclude(adminClient, `user.attributes.Department == "${departmentValue}"`, [
            adminUser.id,
        ]);

        const {app, page} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channel.name});
        await expect(app.center.postCreate).toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);

        // # Navigate to Access Control tab
        await channelSettings.tabs.tab('access_rules').select();

        const tab = channelSettings.accessRules.container;
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add rule (unique value -> only admin remains allowed in the private channel)
        await addAttributeRule(tab.locator, page, departmentValue);

        // # Click Save - confirmation modal appears because memberToRemove will be removed
        const saveBtn = channelSettings.savePanel.saveButton;
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        const confirmModal = new App(page).channelAccessRulesConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 30000});

        // * Summary message shows 0 users added and 1 member removed
        await expect(confirmModal.container).toContainText('remove 1 current channel member');

        // # Confirm and wait for the access-control sync job that applies the removal
        const syncJob = await settle(confirmModal.confirmButton, {wait: Api.CreateJob}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 15000});

        const syncJobId = syncJob.id;
        const finished = await waitForJobCompletion(adminClient, syncJobId, {timeoutMs: 90_000});
        expect(finished.status, `sync job did not succeed: ${JSON.stringify(finished)}`).toBe('success');

        // * Poll until memberToRemove is no longer a channel member
        await expect
            .poll(
                async () => {
                    const members = await adminClient.getChannelMembers(channel.id);
                    return members.some((member) => member.user_id === memberToRemove.id);
                },
                {
                    timeout: 15000,
                    intervals: [500, 1000, 1000, 2000],
                    message: `${memberToRemove.username} should be removed from the channel`,
                },
            )
            .toBe(false);

        await closeChannelSettings(channelSettings);

        // * The ABAC removal system message is posted in the channel
        const removal = await app.center.postList.postList.itemWith(
            {text: 'was removed from the channel'},
            {timeout: 30000},
        );
        await expect(removal.container).toContainText(memberToRemove.username);

        // # Open channel members RHS from the affected channel
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
        await app.channelHeader.menu.membersMenuItem.clickTo(app.rhs.channelMembers);

        // * Admin remains in the RHS members list, and removed member is absent
        await expect(app.rhs.channelMembers.member(adminUser).container).toBeVisible({timeout: 10000});
        await expect(app.rhs.channelMembers.member(memberToRemove).container).not.toBeVisible();
    });
});
