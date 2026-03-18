// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    runSyncJob,
    verifyUserInChannel,
} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createBasicPolicy,
    activatePolicy,
    waitForLatestSyncJob,
    getJobDetailsFromRecentJobs,
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
        const policyName = `Engineering Policy ${await pw.random.id()}`;
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

    /**
     * MM-T5784: Attribute-based access policy created in System Console controls access as specified
     * (one attribute, = is, with auto-add)
     *
     * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5784.md
     *
     * Test Steps:
     * 1. As system admin, go to ABAC page, click Add policy, enter name, set Auto-add = TRUE
     * 2. Select policy values: Attribute, Operator, and Value (just one)
     * 3. Click Test Access Rule, observe users who satisfy the policy are listed
     * 4. Click Add channels and select a channel, then save
     * 5. User who satisfies policy but NOT in channel → should be AUTO-ADDED
     * 6. User who satisfies policy and IS in channel → no change (stays in channel)
     * 7. User who does NOT satisfy policy and IS in channel → auto-removed
     *
     * Expected:
     * - User who satisfies the policy is auto-added
     * - User who does not satisfy the policy is auto-removed
     */
    test('MM-T5784 Create and test policy with auto-add enabled', async ({pw}) => {
        // Increase timeout for this complex test to prevent trace file race conditions
        test.setTimeout(120000); // 2 minutes instead of default 1 minute

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

        // Wait for user attributes to be indexed before creating policy
        await new Promise((resolve) => setTimeout(resolve, 2000));

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
        // STEP 1-4: Login, navigate to ABAC, create policy with auto-add TRUE
        // ============================================================
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        // Use createBasicPolicy with autoSync: true
        const policyName = `Auto-Add Policy ${await pw.random.id()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true, // Auto-add ENABLED for this test
            channels: [privateChannel.display_name],
        });

        // ============================================================
        // STEP 3: Test Access Rule (navigate back to policy to test)
        // ============================================================

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

            await navigateToABACPage(systemConsolePage.page);
        }

        // Wait for initial sync job to complete
        await waitForLatestSyncJob(systemConsolePage.page);

        // Get policy ID and activate it for auto-add to work
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});

        const idMatch = policyName.match(/([a-z0-9]+)$/i);
        const uniqueId = idMatch ? idMatch[1] : policyName;
        await searchInput.fill(uniqueId);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyElementId = await policyRow.getAttribute('id');
        const policyId = policyElementId?.replace('customDescription-', '');

        if (!policyId) {
            throw new Error('Could not get policy ID');
        }
        await searchInput.clear();

        // Activate the policy so auto-add works
        await activatePolicy(adminClient, policyId);

        // Run sync job with active policy
        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        // ============================================================
        // VERIFY VIA JOB DETAILS: Check recent jobs for channel membership changes
        // Note: Sometimes two jobs are created simultaneously, so we check both
        // ============================================================
        const jobDetails = await getJobDetailsFromRecentJobs(systemConsolePage.page, privateChannel.display_name);

        // Expected: +1 added (satisfyingUserNotInChannel)
        // Removed: 2 (nonSatisfyingUserInChannel + admin who created the channel without Department=Engineering)
        expect(jobDetails.added).toBe(1); // satisfyingUserNotInChannel was auto-added
        expect(jobDetails.removed).toBeGreaterThanOrEqual(1); // At least nonSatisfyingUserInChannel was removed (admin may also be removed)

        // ============================================================
        // STEP 5-7: Also verify via API for completeness
        // ============================================================

        // Step 5: User who satisfies policy but NOT in channel → should be AUTO-ADDED
        const user1AfterSync = await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id);
        expect(user1AfterSync).toBe(true); // AUTO-ADDED because auto-add is TRUE

        // Step 6: User who satisfies policy and IS in channel → no change (stays in channel)
        const user2AfterSync = await verifyUserInChannel(adminClient, satisfyingUserInChannel.id, privateChannel.id);
        expect(user2AfterSync).toBe(true); // Stays in channel

        // Step 7: User who does NOT satisfy policy and IS in channel → auto-removed
        const user3AfterSync = await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id);
        expect(user3AfterSync).toBe(false); // AUTO-REMOVED
    });
});
