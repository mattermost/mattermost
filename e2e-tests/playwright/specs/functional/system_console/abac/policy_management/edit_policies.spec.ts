// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel, duration} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {createPrivateChannelForABAC, createUserForABAC, enableUserManagedAttributes} from '../support';
import {
    createMembershipPolicy,
    expectAccessTest,
    fieldNamed,
    openPolicy,
    policyIdByName,
    savePolicy,
    syncJobId,
    setAbacEnabled,
    waitForSyncJob,
} from '../surface';

import {verifyAddedAttributeRule} from './added_attribute_rule';
import {verifyRemovedAttributeRule} from './removed_attribute_rule';

/**
 * ABAC Policy Management - Edit Policies
 * Tests for editing existing ABAC policies
 */
test.describe('ABAC Policy Management - Edit Policies', () => {
    /**
     * MM-T5790: Editing value of existing attribute-based access policy applies access control as specified (without auto-add)
     *
     * Step 1:
     * 1. Go to ABAC page, click a policy to edit. Ensure Auto-add is False
     * 2. Edit an existing policy rule to a different value (same attribute and operator)
     * 3. Click Test Access Rule, observe users who satisfy the policy
     * 4. Save the changes
     * 5. User who satisfies NEW policy but not in channel → NOT auto-added
     */
    test('MM-T5790 Editing policy value applies access control without auto-add', async ({pw}) => {
        test.setTimeout(duration.four_min);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        // Enable user-managed attributes FIRST (same order as MM-T5783)
        await enableUserManagedAttributes(adminClient);

        // Set up the Department attribute field
        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create users with proper CPA attributes
        // User A: Department=Engineering (will satisfy ORIGINAL policy)
        // User B: Department=Sales (will satisfy EDITED policy)
        const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);

        await adminClient.addToTeam(team.id, engineerUser.id);
        await adminClient.addToTeam(team.id, salesUser.id);

        // Create channel - use direct API call for more control
        const channelName = `abac-edit-test-${pw.random.id()}`;

        const privateChannel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            display_name: channelName,
            type: 'P',
        });

        // Admin user is automatically added as channel creator, but let's add the test users
        // Note: addToChannel(userId, channelId) - user first, then channel
        await adminClient.addToChannel(engineerUser.id, privateChannel.id);

        // Verify we can access the channel
        // const channelCheck = await adminClient.getChannel(privateChannel.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // * The engineer is in the channel before any policy
        expect(await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id)).toBe(true);

        // ===========================================
        // PRECONDITION: Create a policy (Department=Engineering), auto-add OFF
        // ===========================================
        const policyName = `ABAC-Edit-Test-${pw.random.id()}`;
        const createJobId = await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: fieldNamed(attributeFieldsMap, 'Department'), value: 'Engineering'}],
            channels: [privateChannel],
            autoAdd: false,
        });
        await waitForSyncJob(adminClient, syncJobId(createJobId));
        const policyId = await policyIdByName(adminClient, policyName);

        // * After the sync, the engineer stays and the sales user (never a member) isn't added
        expect(await verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, salesUser.id, privateChannel.id)).toBe(false);

        // ===========================================
        // STEP 1-2: Edit policy to different value (Sales instead of Engineering)
        // ===========================================
        const policy = await openPolicy(app, policyId);

        // * Auto-add is off
        await expect(policy.channels.autoAddAllCheckbox).not.toBeChecked();

        // # Change the rule's value to Sales
        const rule = policy.rules.row(0);
        await rule.valueInputTextbox.fill('Sales');
        await rule.valueInputTextbox.press('Tab');
        await expect(rule.valueInputTextbox).toHaveValue('Sales');

        // ===========================================
        // STEP 3: Click Test Access Rule
        // ===========================================
        await expectAccessTest(app, policy, {client: adminClient, matching: [salesUser], notMatching: [engineerUser]});

        // ===========================================
        // STEP 4: Save the changes, applying the policy, and wait for its sync
        // ===========================================
        const editJobId = await savePolicy(app, policy);
        await waitForSyncJob(adminClient, syncJobId(editJobId));

        // ===========================================
        // STEP 5 & 6: Verify channel membership after policy edit
        // ===========================================

        // Poll under PW_WORKERS>=2: another shard's sync job may flip membership.
        await expect
            .poll(async () => verifyUserInChannel(adminClient, salesUser.id, privateChannel.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000],
                message: 'salesUser should NOT be in channel (auto-add is off)',
            })
            .toBe(false);
        await expect
            .poll(async () => verifyUserInChannel(adminClient, engineerUser.id, privateChannel.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000],
                message: 'engineerUser should be REMOVED (no longer satisfies policy)',
            })
            .toBe(false);

        // ===========================================
        // STEP 7: Admin can manually add satisfying user
        // ===========================================
        try {
            // Note: addToChannel(userId, channelId) - user first, then channel
            await adminClient.addToChannel(salesUser.id, privateChannel.id);

            // Verify the user was actually added
            const salesInChannelAfterManualAdd = await verifyUserInChannel(
                adminClient,
                salesUser.id,
                privateChannel.id,
            );
            expect(salesInChannelAfterManualAdd).toBe(true);
        } catch (error) {
            throw new Error(`Step 7 FAILED: Admin should be able to manually add satisfying user. Error: ${error}`);
        }
    });

    /**
     * MM-63848: Renaming a policy to a name that already exists should show an error
     */
    test('MM-63848 Should show error when renaming policy to an existing name', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const department = fieldNamed(
            await setupCustomProfileAttributeFields(adminClient, departmentAttribute),
            'Department',
        );

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        const privateChannel2 = await createPrivateChannelForABAC(adminClient, team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // # Create two policies with different names
        const policyName1 = `Edit Dup Test A ${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName1,
            rules: [{field: department, value: 'Engineering'}],
            channels: [privateChannel],
        });
        const policyName2 = `Edit Dup Test B ${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName2,
            rules: [{field: department, value: 'Sales'}],
            channels: [privateChannel2],
        });

        // # Edit policy 2's name to match policy 1, and save (applying it)
        const policy = await openPolicy(app, await policyIdByName(adminClient, policyName2));
        await policy.editPolicy.name.valueTextbox.fill(policyName1);
        await app.admin.saveButton.click();
        await expect(policy.confirmModal).toBeVisible();
        await policy.confirmModal.confirmButton.click();

        // * The editor says the name is taken
        await expect(policy.errorText).toBeVisible();
        await expect(policy.errorText).toContainText('A policy with this name already exists');
    });
    test('MM-T5791 Editing policy to add attribute with auto-add enabled', async ({pw}) => {
        await verifyAddedAttributeRule(pw);
    });

    test('MM-T5792 Editing policy to remove attribute rule with auto-add enabled', async ({pw}) => {
        await verifyRemovedAttributeRule(pw, 'cel');
    });
});
