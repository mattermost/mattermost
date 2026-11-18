// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for ranked comparison operators in the Membership Policy editor.
 *
 * When the selected attribute is of type `rank`, the simple-mode operator
 * dropdown replaces the standard set with the ordinal comparison operators
 * (is exactly, is not, is at least, is greater than, is at most, is less than).
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {deleteAccessControlPoliciesNamed, expect, getRandomId, test, type App, Msg} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../../channels/custom_profile_attributes/helpers';
import {assertAccessControlAutocompleteContains} from '../support';
import {MEMBERSHIP_POLICIES_PATH, openMembershipPolicies, openPolicy, policyIdByName, savePolicy} from '../surface';

const RANKED_OPERATORS = [
    'is exactly',
    'is not',
    'is at least',
    'is greater than',
    'is at most',
    'is less than',
] as const;
const STANDARD_OPERATORS = ['is', 'in', 'has any of', 'has all of', 'starts with', 'ends with', 'contains'] as const;

/** Opens a new policy, names it, and adds a rule on the attribute; returns the rule's row. */
async function newPolicyWithAttribute(app: App, name: string, attribute: UserPropertyField) {
    const policies = await openMembershipPolicies(app);
    await policies.addButton.click();
    const {policy} = app.admin.accessControl;
    await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
    await policy.editPolicy.name.valueTextbox.fill(name);
    await expect(policy.editPolicy.name.valueTextbox).toHaveValue(name);
    const row = policy.rules.row(0);
    await expect(policy.rules.addButton).toBeEnabled();
    await policy.rules.addButton.click();
    await expect(row.attributeMenu.attribute(attribute)).toBeVisible();
    await row.attributeMenu.attribute(attribute).click();
    await expect(row.attributeButton).toContainText(attribute.name);
    return row;
}

test.describe('System Console - Membership Policy ranked operators', () => {
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
    });

    test.afterEach(async () => {
        for (const policyName of policyNames.splice(0)) {
            await deleteAccessControlPoliciesNamed(adminClient, policyName);
        }
        for (const field of fields.splice(0)) {
            await deleteCustomProfileAttributes(adminClient, {[field.id]: field});
        }
    });

    /** Creates an admin-managed ranked attribute (admin-managed → usable in ABAC) and waits for the policy editor to be able to use it. */
    async function createRankedField(): Promise<UserPropertyField> {
        const field = await adminClient.createCustomProfileAttributeField({
            name: `clearance_${getRandomId()}`,
            type: 'rank',
            attrs: {
                sort_order: 0,
                managed: 'admin',
                options: [
                    {name: 'Unclassified', rank: 1},
                    {name: 'Secret', rank: 2},
                    {name: 'TopSecret', rank: 3},
                ],
            },
        } as any);
        fields.push(field);

        // # Make sure ABAC stays enabled (a concurrent initSetup can reset config)
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as any);

        await assertAccessControlAutocompleteContains(adminClient, [field.name]);
        return field;
    }

    /**
     * @objective Selecting a ranked attribute in the policy editor surfaces the
     * ordinal operators and removes the equality/string/list operators; the row
     * defaults to "is at least".
     *
     * @precondition
     * An admin-managed ranked attribute (Unclassified/Secret/TopSecret) exists.
     */
    test('shows ranked comparison operators for a ranked attribute', {tag: '@abac'}, async ({pw}) => {
        const {app} = await pw.testBrowser.login(adminUser);

        // # Create a ranked attribute (ABAC is enabled with it), open a new policy, name it, and add a rule on the attribute
        const field = await createRankedField();
        const row = await newPolicyWithAttribute(app, `Ranked Policy ${getRandomId()}`, field);

        // * The row defaults to the canonical ranked operator, "is at least"
        await expect(row.operatorButton).toContainMessage(Msg.admin.access_control.table_editor.operator.is_at_least);

        // # Open the operator dropdown
        await row.operatorButton.click();
        await expect(app.policyRuleOperatorMenu.operator('is at least')).toBeVisible();

        // * All six ranked operators are offered
        for (const operator of RANKED_OPERATORS) {
            await expect(app.policyRuleOperatorMenu.operator(operator)).toBeVisible();
        }

        // * The standard (non-ranked) operators are not offered
        for (const operator of STANDARD_OPERATORS) {
            await expect(app.policyRuleOperatorMenu.operator(operator)).toHaveCount(0);
        }
    });

    /**
     * @objective An "is at least <option>" rule built in the editor survives a
     * save/reopen round-trip: the stored marker form rehydrates back to the
     * operator form and the table editor re-renders the same operator and value.
     *
     * @precondition
     * An admin-managed ranked attribute (Unclassified/Secret/TopSecret) exists.
     */
    test('round-trips an "is at least" ranked rule through save and reopen', {tag: '@abac'}, async ({pw}) => {
        const {app} = await pw.testBrowser.login(adminUser);
        const policyName = `Ranked RT ${getRandomId()}`;
        policyNames.push(policyName);

        // # Create a policy and add a ranked attribute rule
        const field = await createRankedField();
        const row = await newPolicyWithAttribute(app, policyName, field);

        // * Defaults to "is at least"
        await expect(row.operatorButton).toContainMessage(Msg.admin.access_control.table_editor.operator.is_at_least);

        // # Pick the value "Secret" (the options run Unclassified, Secret, TopSecret)
        await row.value.container.click();
        // The menu is portaled; observe its generated option collection before resolving an option by label.
        await expect(app.policyRuleValueMenu.optionList.locator).toContainText(['Secret']);
        const option = await app.policyRuleValueMenu.optionList.itemWith({text: /^\s*Secret\s*$/});
        await expect(option).toBeVisible();
        await option.click();
        await expect(row.value.container).toContainText('Secret');

        // # Save the policy and reopen it
        await savePolicy(app, app.admin.accessControl.policy);
        await expect(app.page).toHavePath(MEMBERSHIP_POLICIES_PATH);
        const policyId = await policyIdByName(adminClient, policyName);
        const policy = await openPolicy(app, policyId);

        // A simple expression opens in the table editor. The mode toggle is enabled only when
        // isSimpleExpression accepts the stored expression — proving the marker form rehydrated to
        // `>= "Secret"` (a non-rehydrated `_rank_ge(...)` marker would disable the toggle).
        await expect(policy.switchModeButton).toBeEnabled();

        // * The table editor re-parses the rehydrated rule to the same operator
        //   and value (no rank integer surfaced in the value chip)
        const reopened = policy.rules.row(0);
        await expect(reopened.operatorButton).toContainMessage(
            Msg.admin.access_control.table_editor.operator.is_at_least,
        );
        await expect(reopened.value.container).toContainText('Secret');
        await expect(reopened.value.container).not.toContainText('2');
    });
});
