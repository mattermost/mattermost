// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Membership Policy tab (access_rules) in Channel Settings Modal
 * @reference MM-67326 — public and private channels can carry ABAC membership policies
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createParentPolicy,
    assignChannelsToPolicy,
    createPrivateChannel,
    createPublicChannel,
    createGroupConstrainedPrivateChannel,
    setUserAttribute,
    addAttributeRule,
    createTeamAdmin,
    waitForAttributeViewToInclude,
} from '../team_settings/helpers';

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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // * Access Control tab is visible
        await expect(channelSettings.container.getByTestId('access_rules-tab-button')).toBeVisible();

        await channelSettings.close();
    });

    test('MM-67326_c2 Access Control tab hidden when ABAC disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        // ABAC NOT enabled

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // * Access Control tab is NOT visible
        await expect(channelSettings.container.getByTestId('access_rules-tab-button')).not.toBeVisible();

        await channelSettings.close();
    });

    test('MM-67326_c3 Membership Policy tab visible for admin on public channel with ABAC enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const channel = await createPublicChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // * Membership Policy tab is visible on public channels when ABAC is enabled (not group-constrained / not default)
        await expect(channelSettings.container.getByTestId('access_rules-tab-button')).toBeVisible();

        await channelSettings.close();
    });

    test('MM-67326_c4 Access Control tab hidden for group-constrained channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const channel = await createGroupConstrainedPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // * Access Control tab is NOT visible for group-constrained channel
        await expect(channelSettings.container.getByTestId('access_rules-tab-button')).not.toBeVisible();

        await channelSettings.close();
    });

    test('MM-67326_c5 Auto-add checkbox disabled when no rules defined', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // * Auto-add checkbox is disabled — no rules or system policies defined
        const autoAddCheckbox = tab.locator('#autoSyncMembersCheckbox');
        await expect(autoAddCheckbox).toBeDisabled();

        await channelSettings.close();
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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // * System policy banner is visible
        await expect(tab.locator('.ChannelSettingsModal__systemPolicies')).toBeVisible({timeout: 10000});

        await channelSettings.close();
    });

    test('MM-67326_c7 Add attribute rule and save without auto-add', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Admin's Department must satisfy the rule (self-exclusion check)
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add an attribute rule: Department == Engineering
        await addAttributeRule(tab, page, 'Engineering');

        // # Save (auto-add remains off — no confirmation modal for first-time rules with no member changes)
        const saveBtn = tab.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // * SaveChangesPanel disappears — rules were saved
        await expect(saveBtn).not.toBeVisible({timeout: 15000});

        await channelSettings.close();
    });

    test('MM-67326_c8 Auto-add checkbox becomes enabled after adding an attribute rule', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // * Checkbox starts disabled — no rules or system policies
        const autoAddCheckbox = tab.locator('#autoSyncMembersCheckbox');
        await expect(autoAddCheckbox).toBeDisabled();

        // # Add an attribute rule
        await addAttributeRule(tab, page, 'Engineering');

        // * Checkbox is now enabled
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});

        await channelSettings.close();
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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add attribute rule (unique value → preview lists only targetUser to add)
        await addAttributeRule(tab, page, departmentValue);

        // * Unsaved changes must be committed before save; otherwise handleSave can skip the confirmation path
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).toBeVisible({timeout: 15000});

        // # Enable auto-add members
        const autoAddCheckbox = tab.locator('#autoSyncMembersCheckbox');
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});
        await autoAddCheckbox.click();
        await expect(autoAddCheckbox).toBeChecked();

        // # Save — confirmation modal appears because targetUser will be added
        const saveBtn = tab.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // # Confirm in the membership changes modal
        const confirmModal = page.locator('#channel-access-rules-confirm-modal');
        await confirmModal.waitFor({state: 'visible', timeout: 30000});
        await confirmModal.getByRole('button', {name: /Save and apply/}).click();
        await confirmModal.waitFor({state: 'hidden', timeout: 15000});

        // * Poll until target user appears as a channel member (sync job runs asynchronously)
        let isMember = false;
        for (let i = 0; i < 30; i++) {
            try {
                await adminClient.getChannelMember(channel.id, targetUser.id);
                isMember = true;
                break;
            } catch {
                await page.waitForTimeout(1000);
            }
        }
        expect(isMember).toBe(true);

        await channelSettings.close();
    });

    test('MM-67326_c10 Self-exclusion validation prevents saving rule that excludes current user', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Admin is in Engineering — rule requires Sales, so admin would be excluded
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add a rule that excludes the admin: Department == Sales
        await addAttributeRule(tab, page, 'Sales');

        // # Attempt to save
        const saveBtn = tab.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // * Self-exclusion error modal appears
        const selfExclusionModal = page.locator('#confirmModal').filter({hasText: 'Cannot save access rules'});
        await expect(selfExclusionModal).toBeVisible({timeout: 15000});

        // # Dismiss the modal to go back to editing
        await selfExclusionModal.getByRole('button', {name: 'Back to editing'}).click();
        await expect(selfExclusionModal).not.toBeVisible();

        await channelSettings.close();
    });

    test('MM-67326_c11 Unsaved changes — closing modal without saving keeps it open on first click', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add a rule to create unsaved changes
        await addAttributeRule(tab, page, 'Engineering');

        // * SaveChangesPanel is visible — there are unsaved changes
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).toBeVisible({timeout: 5000});

        // # First close click — modal stays open (unsaved-changes two-step close)
        await channelSettings.closeButton.click();
        await expect(channelSettings.container).toBeVisible({timeout: 3000});

        // # Second click — modal closes
        await channelSettings.closeButton.click();
        await expect(channelSettings.container).not.toBeVisible({timeout: 10000});
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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add rule: Department == Engineering (memberToRemove doesn't match → will be removed)
        await addAttributeRule(tab, page, 'Engineering');

        // # Click Save — confirmation modal appears because memberToRemove will be removed
        const saveBtn = tab.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        const confirmModal = page.locator('#channel-access-rules-confirm-modal');
        await confirmModal.waitFor({state: 'visible', timeout: 30000});

        // * Summary message shows 0 users added and 1 member removed
        await expect(confirmModal).toContainText('remove 1 current channel member');

        // # Click "View users" to open the detailed user list
        await confirmModal.getByRole('button', {name: 'View users'}).click();

        // * "Restricted (1)" tab is visible — one member will be removed
        await expect(confirmModal.getByRole('button', {name: /Restricted \(1\)/})).toBeVisible({timeout: 5000});

        // # Switch to the Restricted tab
        await confirmModal.getByRole('button', {name: /Restricted \(1\)/}).click();

        // * memberToRemove's username appears in the restricted list
        await expect(confirmModal).toContainText(memberToRemove.username, {timeout: 5000});

        // # Cancel — don't actually apply
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await confirmModal.waitFor({state: 'hidden', timeout: 10000});

        await channelSettings.close();
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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // # Navigate to Access Control tab
        await channelSettings.container.getByTestId('access_rules-tab-button').click();

        const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
        await expect(tab).toBeVisible({timeout: 10000});

        // # Add rule (unique value → only memberToAdd appears in "to add" with this server data)
        await addAttributeRule(tab, page, departmentValue);
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).toBeVisible({timeout: 15000});

        // # Enable auto-add so memberToAdd appears in the "to add" list
        const autoAddCheckbox = tab.locator('#autoSyncMembersCheckbox');
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});
        await autoAddCheckbox.click();
        await expect(autoAddCheckbox).toBeChecked();

        // # Click Save — confirmation modal appears because memberToAdd will be added
        const saveBtn = tab.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        const confirmModal = page.locator('#channel-access-rules-confirm-modal');
        await confirmModal.waitFor({state: 'visible', timeout: 30000});

        // * Summary shows 0 members removed (no one in this channel lacks the attribute)
        await expect(confirmModal).toContainText('remove 0 current channel members');

        // # Click "View users" to open the detailed user list
        await confirmModal.getByRole('button', {name: 'View users'}).click();

        // * Allowed tab is visible with at least one user (memberToAdd)
        await expect(confirmModal.locator('.ChannelAccessRulesConfirmModal__tab', {hasText: /Allowed/})).toBeVisible({
            timeout: 5000,
        });

        // # The Allowed tab is active by default — verify memberToAdd's username is shown (unique Dept avoids other matches)
        await expect(confirmModal).toContainText(memberToAdd.username, {timeout: 5000});

        // # Cancel — don't actually apply
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await confirmModal.waitFor({state: 'hidden', timeout: 10000});

        await channelSettings.close();
    });
});
