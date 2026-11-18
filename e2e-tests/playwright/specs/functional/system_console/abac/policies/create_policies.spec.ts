// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel, duration} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {activatePolicy, createPrivateChannelForABAC, createUserForABAC, enableUserManagedAttributes} from '../support';
import {
    addRule,
    createMembershipPolicy,
    expectAccessTest,
    fieldNamed,
    openMembershipPolicies,
    openPolicy,
    policyIdByName,
    runSyncJob,
    setAbacEnabled,
    syncJobId,
    waitForSyncJob,
} from '../surface';

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
        await enableUserManagedAttributes(adminClient);
        const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttribute);
        const department = fieldNamed(attributeFieldsMap, 'Department');

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
        await adminClient.addToTeam(team.id, satisfyingUserNotInChannel.id);
        await adminClient.addToTeam(team.id, satisfyingUserInChannel.id);
        await adminClient.addToTeam(team.id, nonSatisfyingUserInChannel.id);

        // Create private channel and add users 2 and 3 (but NOT user 1)
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(satisfyingUserInChannel.id, privateChannel.id);
        await adminClient.addToChannel(nonSatisfyingUserInChannel.id, privateChannel.id);

        // * Verify initial channel state
        expect(await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id)).toBe(false);
        expect(await verifyUserInChannel(adminClient, satisfyingUserInChannel.id, privateChannel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id)).toBe(true);

        // # Log in, turn attribute-based access on, and create the policy with auto-add off
        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);
        const policyName = `Engineering Policy ${pw.random.id()}`;
        const jobId = syncJobId(
            await createMembershipPolicy(app, {
                name: policyName,
                rules: [{field: department, value: 'Engineering'}],
                channels: [privateChannel],
                autoAdd: false,
            }),
        );

        // * Testing the rule lists the users who satisfy it, and not the one who doesn't
        const policy = await openPolicy(app, await policyIdByName(adminClient, policyName));
        await expectAccessTest(app, policy, {
            client: adminClient,
            matching: [satisfyingUserNotInChannel, satisfyingUserInChannel],
            notMatching: [nonSatisfyingUserInChannel],
        });

        // # Wait for the sync the policy started
        await waitForSyncJob(adminClient, jobId);

        // * The satisfying user outside the channel is NOT auto-added (auto-add is off)
        expect(await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id)).toBe(false);

        // * The satisfying member stays
        expect(await verifyUserInChannel(adminClient, satisfyingUserInChannel.id, privateChannel.id)).toBe(true);

        // * The member who doesn't satisfy it is removed
        expect(await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id)).toBe(false);

        // # The admin can add the satisfying user by hand
        await adminClient.addToChannel(satisfyingUserNotInChannel.id, privateChannel.id);
        expect(await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id)).toBe(true);

        // # Try to add the user who does NOT satisfy the policy
        await expect(adminClient.addToChannel(nonSatisfyingUserInChannel.id, privateChannel.id)).rejects.toThrow();

        // * The policy keeps them out
        expect(await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id)).toBe(false);
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
        test.setTimeout(duration.two_min);

        // # Skip test if no license for ABAC
        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP: Create users and channel BEFORE creating policy
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttribute);
        const department = fieldNamed(attributeFieldsMap, 'Department');

        const satisfyingUserNotInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        const satisfyingUserInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        const nonSatisfyingUserInChannel = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);
        await adminClient.addToTeam(team.id, satisfyingUserNotInChannel.id);
        await adminClient.addToTeam(team.id, satisfyingUserInChannel.id);
        await adminClient.addToTeam(team.id, nonSatisfyingUserInChannel.id);

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(satisfyingUserInChannel.id, privateChannel.id);
        await adminClient.addToChannel(nonSatisfyingUserInChannel.id, privateChannel.id);

        // * Verify initial channel state
        expect(await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id)).toBe(false);
        expect(await verifyUserInChannel(adminClient, satisfyingUserInChannel.id, privateChannel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id)).toBe(true);

        // # Steps 1-4: log in, turn attribute-based access on, create the policy with auto-add on
        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);
        const policyName = `Auto-Add Policy ${pw.random.id()}`;
        const jobId = syncJobId(
            await createMembershipPolicy(app, {
                name: policyName,
                rules: [{field: department, value: 'Engineering'}],
                channels: [privateChannel],
                autoAdd: true,
            }),
        );

        // * Step 3: testing the rule lists the users who satisfy it, and not the one who doesn't
        const policyId = await policyIdByName(adminClient, policyName);
        const policy = await openPolicy(app, policyId);
        await expectAccessTest(app, policy, {
            client: adminClient,
            matching: [satisfyingUserNotInChannel, satisfyingUserInChannel],
            notMatching: [nonSatisfyingUserInChannel],
        });

        // # Wait for the initial sync, activate the policy so auto-add works, and sync again
        await waitForSyncJob(adminClient, jobId);
        await activatePolicy(adminClient, policyId);
        await waitForSyncJob(adminClient, await runSyncJob(app));

        // * Step 5: the satisfying user outside the channel is auto-added
        expect(await verifyUserInChannel(adminClient, satisfyingUserNotInChannel.id, privateChannel.id)).toBe(true);

        // * Step 6: the satisfying member stays
        expect(await verifyUserInChannel(adminClient, satisfyingUserInChannel.id, privateChannel.id)).toBe(true);

        // * Step 7: the member who doesn't satisfy it is removed
        expect(await verifyUserInChannel(adminClient, nonSatisfyingUserInChannel.id, privateChannel.id)).toBe(false);
    });

    test('MM-63848 Should show error when creating policy with duplicate name', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const department = fieldNamed(
            await setupCustomProfileAttributeFields(adminClient, departmentAttribute),
            'Department',
        );
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // # Create the first policy
        const policyName = `Duplicate Test ${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: department, value: 'Engineering'}],
            channels: [privateChannel],
        });
        const {policy} = app.admin.accessControl;

        // * No error the first time
        await expect(policy.errorText).toHaveCount(0);

        // # Create another policy with the same name
        const policies = await openMembershipPolicies(app);
        await policies.addButton.click();
        await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
        await policy.editPolicy.name.valueTextbox.fill(policyName);
        await expect(policy.editPolicy.name.valueTextbox).toHaveValue(policyName);
        await addRule(policy.rules, {field: department, value: 'Sales'});
        await app.admin.saveButton.click();

        // * The editor says the name is taken
        await expect(policy.errorText).toBeVisible();
        await expect(policy.errorText).toContainText('A policy with this name already exists');
    });
});
