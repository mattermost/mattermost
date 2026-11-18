// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel, duration, type PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    createPrivateChannelForABAC,
    createUserForABAC,
    enableUserManagedAttributes,
    getUserAttributeFieldByName,
} from '../support';
import {deleteFieldFromDB} from '../masking/masking_db_setup';
import {
    addRule,
    createMembershipPolicy,
    expectAccessTest,
    openPolicy,
    policyIdByName,
    savePolicy,
    syncJobId,
    setAbacEnabled,
    waitForSyncJob,
} from '../surface';

/** Verifies membership after adding a rule in the Simple editor. */
export async function verifyAddedAttributeRule(pw: PlaywrightExtended) {
    test.setTimeout(duration.four_min);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    // Ensure Office field exists with correct managed:admin permissions.
    // Fields created by older server versions may lack permission_values, causing 403
    // when setting attribute values — delete and recreate if permission_values is missing.
    // Legacy fields with permission_field=null reject API deletion (403), so fall back to DB.
    await enableUserManagedAttributes(adminClient);
    const existingFields = await adminClient.getCustomProfileAttributeFields();
    const attributeFieldsMap: Record<string, any> = {};
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
    const existingOffice = existingFields.find((f: any) => f.name === 'Office') as any;
    if (!existingOffice || !(existingOffice as any).permission_values) {
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
            attrs: {managed: 'admin', visibility: 'when_set', sort_order: 1},
        } as any);
        attributeFieldsMap[officeField.id] = officeField;
    }

    // Wait until the policy editor's attribute list (the access control fields) has the Office field
    await expect
        .poll(async () => (await adminClient.getAccessControlFields('', 100)).map((field) => field.name), {
            message: 'the access control fields never listed Office',
        })
        .toContain('Office');

    // Create users:
    // 1. engineerRemoteUser: Dept=Engineering, Office=Remote → satisfies BOTH (after edit)
    // 2. engineerOfficeUser: Dept=Engineering, Office=HQ → satisfies ORIGINAL only, NOT the edited policy
    // 3. salesUser: Dept=Sales → doesn't satisfy any policy

    const engineerRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
        {name: 'Office', type: 'text', value: 'Remote'},
    ]);

    const engineerOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
        {name: 'Office', type: 'text', value: 'HQ'},
    ]);

    const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
    ]);

    // Add users to team
    await adminClient.addToTeam(team.id, engineerRemoteUser.id);
    await adminClient.addToTeam(team.id, engineerOfficeUser.id);
    await adminClient.addToTeam(team.id, salesUser.id);

    // Create channel and add engineerOfficeUser (satisfies original policy)
    const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(engineerOfficeUser.id, privateChannel.id);

    const department = await getUserAttributeFieldByName(adminClient, 'Department');
    const office = await getUserAttributeFieldByName(adminClient, 'Office');

    const {app} = await pw.testBrowser.login(adminUser);
    await setAbacEnabled(app, true);

    // ===========================================
    // PRECONDITION: Create ORIGINAL policy with ONE attribute (Department=Engineering)
    // Auto-add ON so users are auto-added
    // ===========================================
    const policyName = `ABAC-AddAttr-Test-${pw.random.id()}`;
    const createJobId = await createMembershipPolicy(app, {
        name: policyName,
        rules: [{field: department, value: 'Engineering'}],
        channels: [privateChannel],
        autoAdd: true,
    });
    await waitForSyncJob(adminClient, syncJobId(createJobId));
    const policyId = await policyIdByName(adminClient, policyName);

    // ===========================================
    // STEP 1-2: Edit policy to ADD another attribute (Office=Remote)
    // New expression: Department=Engineering AND Office=Remote
    // ===========================================
    const policies = app.admin.accessControl.policies;
    await policies.searchTextbox.fill(policyName);
    await expect(policies.row(policyId)).toBeVisible();

    const policy = await openPolicy(app, policyId);
    await expect(policy.channels.autoAddAllCheckbox).toBeChecked();
    await expect(policy.switchModeButton).toBeEnabled({timeout: duration.one_min});

    // A simple expression opens in the table editor.
    await expect(policy.cel.input).not.toBeVisible();
    await expect(policy.rules.addButton).toBeVisible();
    await addRule(policy.rules, {field: office, value: 'Remote'});

    // ===========================================
    // STEP 3: Test Access Rule
    // ===========================================
    await expectAccessTest(app, policy, {
        client: adminClient,
        matching: [engineerRemoteUser],
        notMatching: [engineerOfficeUser, salesUser],
    });

    // ===========================================
    // STEP 4: Save the changes, applying the policy, and wait for its sync
    // ===========================================
    const editSyncJobId = await savePolicy(app, policy);
    await waitForSyncJob(adminClient, syncJobId(editSyncJobId));

    // ===========================================
    // STEP 5 & 6: Verify channel membership after edit
    // ===========================================

    // Poll under PW_WORKERS>=2: another shard's sync job may briefly change
    // membership after we read it, so we retry until stable.
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerRemoteUser.id, privateChannel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerRemoteUser should be in channel (satisfies BOTH attributes)',
        })
        .toBe(true);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, engineerOfficeUser.id, privateChannel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerOfficeUser should be REMOVED (does not satisfy new policy)',
        })
        .toBe(false);
    await expect
        .poll(async () => verifyUserInChannel(adminClient, salesUser.id, privateChannel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'salesUser should not be in channel',
        })
        .toBe(false);
}
