// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, test, verifyUserInChannel, duration, type PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    createPrivateChannelForABAC,
    createUserForABAC,
    enableUserManagedAttributes,
    getUserAttributeFieldByName,
} from '../support';
import {deleteFieldFromDB} from '../masking/masking_db_setup';
import {
    createMembershipPolicy,
    expectAccessTest,
    openPolicy,
    policyIdByName,
    savePolicy,
    syncJobId,
    setAbacEnabled,
    setCelExpression,
    waitForSyncJob,
} from '../surface';

/** Verifies membership updates after removing a rule through either policy editor. */
export async function verifyRemovedAttributeRule(pw: PlaywrightExtended, mode: 'simple' | 'cel') {
    test.setTimeout(duration.four_min);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // Ensure Office field exists with correct managed:admin permissions.
    // Fields created by older server versions may lack permission_values, causing 403
    // when setting attribute values — delete and recreate if permission_values is missing.
    // Legacy fields with permission_field=null reject API deletion (403), so fall back to DB.
    await enableUserManagedAttributes(adminClient);
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    const attributeFieldsMap: Record<string, UserPropertyField> = {};
    for (const field of existingFields) {
        attributeFieldsMap[field.id] = field;
    }
    const existingDepartment = existingFields.find((field) => field.name === 'Department');
    if (!existingDepartment?.permission_values) {
        if (existingDepartment) {
            try {
                await adminClient.deleteCustomProfileAttributeField(existingDepartment.id);
            } catch {
                await deleteFieldFromDB(existingDepartment.id);
            }
            delete attributeFieldsMap[existingDepartment.id];
        }
        const department = await adminClient.createCustomProfileAttributeField({
            name: 'Department',
            type: 'text',
            attrs: {managed: 'admin', visibility: 'when_set', sort_order: 0, value_type: ''},
        });
        attributeFieldsMap[department.id] = department;
    }
    const existingOffice = existingFields.find((field) => field.name === 'Office');
    if (!existingOffice?.permission_values) {
        if (existingOffice) {
            try {
                await adminClient.deleteCustomProfileAttributeField(existingOffice.id);
            } catch {
                await deleteFieldFromDB(existingOffice.id);
            }
            delete attributeFieldsMap[existingOffice.id];
        }
        const officeField = await adminClient.createCustomProfileAttributeField({
            name: 'Office',
            type: 'text',
            attrs: {managed: 'admin', visibility: 'when_set', sort_order: 1, value_type: ''},
        });
        attributeFieldsMap[officeField.id] = officeField;
    }

    // Wait until the policy editor's attribute list (the access control fields) has the Office field
    await expect
        .poll(async () => (await adminClient.getAccessControlFields('', 100)).map((field) => field.name), {
            message: 'the access control fields never listed Office',
        })
        .toContain('Office');
    await enableUserManagedAttributes(adminClient);

    // Create users:
    // 1. engineerRemoteUser: Dept=Engineering, Office=Remote → satisfies ORIGINAL (both rules)
    // 2. engineerOfficeUser: Dept=Engineering, Office=HQ → satisfies EDITED policy (Dept only)
    // 3. salesRemoteUser: Dept=Sales, Office=Remote → doesn't satisfy (wrong Dept)

    const engineerRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
        {name: 'Office', type: 'text', value: 'Remote'},
    ]);

    const engineerOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
        {name: 'Office', type: 'text', value: 'HQ'},
    ]);

    const salesRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
        {name: 'Office', type: 'text', value: 'Remote'},
    ]);

    // Add users to team
    await adminClient.addToTeam(team.id, engineerRemoteUser.id);
    await adminClient.addToTeam(team.id, engineerOfficeUser.id);
    await adminClient.addToTeam(team.id, salesRemoteUser.id);

    // Create channel and add salesRemoteUser (does NOT satisfy any policy)
    const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesRemoteUser.id, privateChannel.id);

    const office = await getUserAttributeFieldByName(adminClient, 'Office');

    const {app} = await pw.testBrowser.login(adminUser);
    await setAbacEnabled(app, true);

    // ===========================================
    // PRECONDITION: Create ORIGINAL policy with TWO attributes
    // Department=Engineering AND Office=Remote, Auto-add ON
    // ===========================================
    const policyName = `ABAC-RemoveRule-${pw.random.id()}`;
    const createJobId = await createMembershipPolicy(app, {
        name: policyName,
        cel: 'user.attributes.Department == "Engineering" && user.attributes.Office == "Remote"',
        channels: [privateChannel],
        autoAdd: true,
    });
    await waitForSyncJob(adminClient, syncJobId(createJobId));
    const policyId = await policyIdByName(adminClient, policyName);

    // ===========================================
    // STEP 1-2: Edit policy to REMOVE the Office rule
    // New expression: Department=Engineering (only)
    // ===========================================
    const policy = await openPolicy(app, policyId);

    // * Auto-add is ON
    await expect(policy.channels.autoAddAllCheckbox).toBeChecked();

    // # Remove the Office condition in the selected editor.
    if (mode === 'simple') {
        await expect(policy.switchModeButton).toBeEnabled({timeout: duration.one_min});
        // A simple expression opens in the table editor.
        const officeRule = policy.rules.row(1);
        await expect(officeRule.attributeButton).toContainText(office.name);
        await officeRule.removeButton.click();
        await expect(policy.rules.rowList).toHaveKeyCount(1);
    } else {
        await setCelExpression(app, policy, 'user.attributes.Department == "Engineering"');
    }

    // ===========================================
    // STEP 3: Test Access Rule
    // ===========================================
    await expectAccessTest(app, policy, {
        client: adminClient,
        matching: [engineerRemoteUser, engineerOfficeUser],
        notMatching: [salesRemoteUser],
    });

    // ===========================================
    // STEP 4: Save the changes, applying the policy, and wait for its sync
    // ===========================================
    const editSyncJobId = await savePolicy(app, policy);
    await waitForSyncJob(adminClient, syncJobId(editSyncJobId));

    // ===========================================
    // STEP 5 & 6: Verify channel membership after edit
    // ===========================================

    // Re-apply guard: a concurrent initSetup() may have reset ABAC between the policy save
    // and the sync job completing. Without ABAC enabled the sync job is a no-op.
    await adminClient.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
    });

    // Poll under PW_WORKERS>=2: other shards' sync jobs may briefly change membership.
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerOfficeUser should be AUTO-ADDED (satisfies simpler Dept-only policy)',
        })
        .toBe(true);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerRemoteUser should still be in channel',
        })
        .toBe(true);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, salesRemoteUser.id, privateChannel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'salesRemoteUser should NOT be in channel',
        })
        .toBe(false);
}
