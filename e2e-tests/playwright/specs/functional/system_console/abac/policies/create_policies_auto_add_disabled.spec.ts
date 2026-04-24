// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage, verifyUserInChannel} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createBasicPolicy,
    waitForLatestSyncJob,
    enableUserManagedAttributes,
} from '../support';

/**
 * ABAC Policies - Create Policies
 * Tests for creating ABAC policies with different auto-add settings
 */
test.describe('ABAC Policies - Create Policies', () => {
    test('MM-T5783 Create and test policy with auto-add disabled', async ({pw}) => {
        // # Skip test if no license for ABAC
        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP: Create users and channel BEFORE creating policy
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();

        // Enable user-managed attributes
        await enableUserManagedAttributes(adminClient);

        // Define and create the Department attribute field
        const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttribute);

        // Create 3 users as per test case:
        // 1. satisfyingUserNotInChannel - Department=Engineering, NOT in channel initially
        // 2. satisfyingUserInChannel - Department=Engineering, IN channel initially
        // 3. nonSatisfyingUserInChannel - Department=Sales, IN channel initially

        const satisfyingUserNotInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);

        const satisfyingUserInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);

        const nonSatisfyingUserInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        // Add all users to the team
        await adminClient.addToTeam(team.id, satisfyingUserNotInChannel.id);
        await adminClient.addToTeam(team.id, satisfyingUserInChannel.id);
        await adminClient.addToTeam(team.id, nonSatisfyingUserInChannel.id);

        // Create private channel and add users 2 and 3 (but NOT user 1)
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(satisfyingUserInChannel.id, privateChannel.id);
        await adminClient.addToChannel(nonSatisfyingUserInChannel.id, privateChannel.id);

        // Verify initial channel state
        const initialUser1InChannel = await verifyUserInChannel(
            adminClient,
            satisfyingUserNotInChannel.id,
            privateChannel.id,
        );
        const initialUser2InChannel = await verifyUserInChannel(
            adminClient,
            satisfyingUserInChannel.id,
            privateChannel.id,
        );
        const initialUser3InChannel = await verifyUserInChannel(
            adminClient,
            nonSatisfyingUserInChannel.id,
            privateChannel.id,
        );
        expect(initialUser1InChannel).toBe(false);
        expect(initialUser2InChannel).toBe(true);
        expect(initialUser3InChannel).toBe(true);

        // ============================================================
        // STEP 1-4: Login, navigate to ABAC, create policy with rule and channel
        // ============================================================
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        // Use the working createBasicPolicy helper (same as MM-T5784)
        const policyName = `Engineering Policy ${pw.random.id()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false, // Auto-add DISABLED for this test
            channels: [privateChannel.display_name],
        });

        // ============================================================
        // STEP 3: Test Access Rule (navigate back to policy to test)
        // ============================================================

        // Navigate back to policy to test the access rule
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
        if (await policyRowForTest.isVisible({timeout: 3000})) {
            await policyRowForTest.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            const testResult = await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [satisfyingUserNotInChannel.username, satisfyingUserInChannel.username],
                expectedNonMatchingUsers: [nonSatisfyingUserInChannel.username],
            });

            expect(testResult.expectedUsersMatch).toBe(true);
            expect(testResult.unexpectedUsersMatch).toBe(false);

            // Navigate back to ABAC page
            await navigateToABACPage(systemConsolePage.page);
        }

        // Wait for sync job to complete (triggered by createBasicPolicy)
        await waitForLatestSyncJob(systemConsolePage.page);

        // ============================================================
        // STEP 5-7: Verify channel membership after sync
        // ============================================================

        // Step 5: User who satisfies policy but NOT in channel → should NOT be auto-added
        const user1AfterSync = await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id);
        expect(user1AfterSync).toBe(false); // NOT auto-added because auto-add is FALSE

        // Step 6: User who satisfies policy and IS in channel → no change (stays in channel)
        const user2AfterSync = await verifyUserInChannel(adminClient, satisfyingUserInChannel.id, privateChannel.id);
        expect(user2AfterSync).toBe(true); // Stays in channel

        // Step 7: User who does NOT satisfy policy and IS in channel → auto-removed
        const user3AfterSync = await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id);
        expect(user3AfterSync).toBe(false); // AUTO-REMOVED

        // ============================================================
        // STEP 8: Admin can manually add the satisfying user to channel
        // Validate: satisfying user CAN be added, non-satisfying user CANNOT
        // ============================================================

        // 8a. Add user who SATISFIES the policy - should succeed
        await adminClient.addToChannel(satisfyingUserNotInChannel.id, privateChannel.id);
        const user1AfterManualAdd = await verifyUserInChannel(
            adminClient,
            satisfyingUserNotInChannel.id,
            privateChannel.id,
        );
        expect(user1AfterManualAdd).toBe(true); // Successfully added by admin

        // 8b. Try to add user who does NOT satisfy the policy - should FAIL
        try {
            await adminClient.addToChannel(nonSatisfyingUserInChannel.id, privateChannel.id);
        } catch {
            // Expected to fail - policy prevents non-compliant users
        }

        // Verify the non-satisfying user is NOT in the channel
        const user3AfterAttempt = await verifyUserInChannel(
            adminClient,
            nonSatisfyingUserInChannel.id,
            privateChannel.id,
        );
        expect(user3AfterAttempt).toBe(false); // Policy prevents non-compliant users
    });
});
