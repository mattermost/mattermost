// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration} from '@mattermost/playwright-lib';

import {ensureUserAttributes, getUserAttributeFieldByName} from '../support';
import {
    MEMBERSHIP_POLICIES_PATH,
    createMembershipPolicy,
    openMembershipPolicies,
    policyIdByName,
    setAbacEnabled,
} from '../surface';

/**
 * @objective E2E coverage for membership policy edit action navigation:
 *   - Clicking Edit in the policy row action menu navigates to the membership policy editor
 *
 * @reference MM-68958: Fix membership policy edit action navigation
 */
test.describe('ABAC Policy Management - Edit Action Navigation', () => {
    /**
     * MM-68958: Edit action in policy row menu navigates to membership policy editor
     *
     * Steps:
     * 1. Enable ABAC and create a membership policy
     * 2. Navigate to System Console > Membership Policies
     * 3. Open a policy row's three-dot action menu
     * 4. Click Edit
     * 5. Verify the URL is /admin_console/system_attributes/membership_policies/edit_policy/<policy_id>
     */
    test('MM-68958 Edit action navigates to membership policy editor', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const department = await getUserAttributeFieldByName(adminClient, 'Department');

        // Create a test channel for the policy
        const channelName = `abac-edit-nav-test-${pw.random.id()}`;
        const privateChannel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'P',
        });

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // # Step 1: create a basic membership policy
        const policyName = `Edit-Nav-Test-${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: department, value: 'Engineering'}],
            channels: [privateChannel],
        });
        const policyId = await policyIdByName(adminClient, policyName);

        // # Steps 2-4: open the list, find the policy, and choose Edit from its row menu
        const policies = await openMembershipPolicies(app);
        await policies.searchTextbox.fill(policyName);
        await policies.row(policyId).openMenuButton.click();
        const menu = app.accessPolicyRowMenu;
        await expect(menu.editMenuItem).toBeVisible();
        await menu.editMenuItem.click();

        // * Step 5: the editor for that policy opens
        await expect(app.page).toHavePath(`${MEMBERSHIP_POLICIES_PATH}/edit_policy/${policyId}`);
        await expect(app.admin.accessControl.policy.editPolicy.name.valueTextbox).toBeVisible();
        await expect(app.admin.accessControl.policy.editPolicy.name.valueTextbox).toHaveValue(policyName);
    });

    /**
     * MM-68958: Row click also navigates to membership policy editor
     *
     * This test verifies that clicking the row (not just the Edit action) also navigates correctly.
     * This behavior should have been working before, but we verify it still works after the fix.
     */
    test('Row click navigates to membership policy editor', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const department = await getUserAttributeFieldByName(adminClient, 'Department');

        // Create a test channel for the policy
        const channelName = `abac-row-click-test-${pw.random.id()}`;
        const privateChannel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'P',
        });

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // # Create a basic membership policy
        const policyName = `Row-Click-Test-${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: department, value: 'Sales'}],
            channels: [privateChannel],
        });
        const policyId = await policyIdByName(adminClient, policyName);

        // # Open the list, find the policy, and click its row (not the action menu)
        const policies = await openMembershipPolicies(app);
        await policies.searchTextbox.fill(policyName);
        // The DataGrid name cell opens the editor but has no operable role or click driver.
        await policies.row(policyId).cell('name').click();

        // * The editor for that policy opens
        await expect(app.page).toHavePath(`${MEMBERSHIP_POLICIES_PATH}/edit_policy/${policyId}`);
        await expect(app.admin.accessControl.policy.editPolicy.name.valueTextbox).toHaveValue(policyName);
    });
});
