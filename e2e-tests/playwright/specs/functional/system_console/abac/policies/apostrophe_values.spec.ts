// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for MM-64357 in the Membership Policy editor.
 *
 * A rule value containing a quote character (e.g. the apostrophe in
 * "Matt's Department") must still be recognized as a simple expression. Before
 * the fix the quoted-value matcher forbade any inner quote, so such a rule was
 * misclassified as complex: the "Switch to Simple Mode" toggle became disabled
 * and the admin was trapped in Advanced mode after a save/reopen.
 *
 * These specs drive the rendered UI (button enabled/disabled state and the
 * save -> reopen round-trip) rather than the helper functions directly, which
 * is the coverage gap flagged in review.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {deleteAccessControlPoliciesNamed, expect, getRandomId, test, duration, Msg} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../../channels/custom_profile_attributes/helpers';
import {
    addRule,
    MEMBERSHIP_POLICIES_PATH,
    openMembershipPolicies,
    openPolicy,
    policyIdByName,
    savePolicy,
} from '../surface';

const APOSTROPHE_VALUE = "Matt's Department";

test.describe('System Console - Membership Policy apostrophe values (MM-64357)', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    const fields: UserPropertyField[] = [];
    const policyNames: string[] = [];

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        if (!clientInfo.adminUser) {
            throw new Error('The admin user could not log in');
        }
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser;

        // # Make sure ABAC stays enabled (a concurrent initSetup can reset config)
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as any);
    });

    test.afterEach(async () => {
        for (const policyName of policyNames.splice(0)) {
            await deleteAccessControlPoliciesNamed(adminClient, policyName);
        }
        for (const field of fields.splice(0)) {
            await deleteCustomProfileAttributes(adminClient, {[field.id]: field});
        }
    });

    /**
     * @objective A rule whose value contains an apostrophe survives a
     * save/reopen round-trip: the stored expression rehydrates as a simple
     * expression so the "Switch to Simple Mode" toggle stays enabled (the admin
     * is not trapped in Advanced mode) and the table editor re-renders the same
     * value.
     *
     * @precondition
     * An admin-managed text attribute exists.
     */
    test('round-trips an apostrophe "is" value and keeps the mode toggle switchable', {tag: '@abac'}, async ({pw}) => {
        // # Create an admin-managed text attribute (admin-managed → usable in ABAC)
        const field = await adminClient.createCustomProfileAttributeField({
            name: `department_${getRandomId()}`,
            type: 'text',
            attrs: {
                sort_order: 0,
                managed: 'admin',
            },
        } as any);
        fields.push(field);

        const {app} = await pw.testBrowser.login(adminUser);
        const policyName = `Apostrophe RT ${getRandomId()}`;
        policyNames.push(policyName);

        // # Create a policy and add a text attribute rule with a value containing an apostrophe
        const policies = await openMembershipPolicies(app);
        await policies.addButton.click();
        const {policy} = app.admin.accessControl;
        await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
        await policy.editPolicy.name.valueTextbox.fill(policyName);
        await expect(policy.editPolicy.name.valueTextbox).toHaveValue(policyName);
        const row = await addRule(policy.rules, {field, value: APOSTROPHE_VALUE});

        // * A text attribute defaults to the "is" operator
        await expect(row.operatorButton).toContainMessage(Msg.admin.access_control.table_editor.operator.is);
        await expect(row.valueInputTextbox).toHaveValue(APOSTROPHE_VALUE);

        // # Save the policy and reopen it
        await savePolicy(app, app.admin.accessControl.policy);
        await expect(app.page).toHavePath(MEMBERSHIP_POLICIES_PATH);
        const policyId = await policyIdByName(adminClient, policyName);
        const reopened = await openPolicy(app, policyId);

        // # Switch to Advanced mode so the "Switch to Simple Mode" toggle is present.
        await expect(reopened.switchModeButton).toHaveMessage(
            Msg.admin.access_control.policy.edit_policy.switch_to_advanced,
        );
        await expect(reopened.switchModeButton).toBeEnabled({timeout: duration.one_min});
        await reopened.switchModeButton.click();

        // * The stored apostrophe expression classifies as simple, so the
        //   toggle back to Simple mode stays enabled (before the fix it was
        //   disabled, trapping the admin in Advanced mode).
        await expect(reopened.switchModeButton).toHaveMessage(
            Msg.admin.access_control.policy.edit_policy.switch_to_simple,
        );
        await expect(reopened.switchModeButton).toBeEnabled();

        // # Return to Simple mode and confirm the value round-tripped intact
        await reopened.switchModeButton.click();
        await expect(reopened.rules.row(0).operatorButton).toContainMessage(
            Msg.admin.access_control.table_editor.operator.is,
        );
        await expect(reopened.rules.row(0).valueInputTextbox).toHaveValue(APOSTROPHE_VALUE);
    });
});
