// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {deleteAccessControlPolicyIfPresent, expect, test, duration, Msg} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {fieldNamed, fillRuleValue, openMembershipPolicies, policyIdByName, setAbacEnabled} from '../surface';

type FieldsMap = Record<string, UserPropertyField>;

async function clearExistingFields(client: Client4): Promise<void> {
    const existing = await client.getCustomProfileAttributeFields();
    if (existing.length) {
        const map: FieldsMap = {};
        for (const f of existing) {
            map[f.id] = f;
        }
        await deleteCustomProfileAttributes(client, map);
    }
}

test.describe('ABAC Attribute Selector - display_name rendering and filtering', () => {
    /**
     * @objective Verify the attribute selector renders display_name when set,
     * falls back to `name`, filters on both, and persists the CEL identifier
     * in saved policy expressions.
     *
     * @precondition
     * Two admin-managed CPA fields seeded via REST: `dept_head` with
     * display_name 'Department Head', and `office` with no display_name.
     */
    test(
        'renders and filters by display_name while persisting CEL identifier',
        {tag: '@user_attributes'},
        async ({pw}) => {
            test.setTimeout(duration.two_min);

            await pw.ensureLicense();
            await pw.skipIfNoLicense();

            const {adminUser, adminClient} = await pw.initSetup();

            await clearExistingFields(adminClient);

            const seedAttributes: CustomProfileAttribute[] = [
                {
                    name: 'dept_head',
                    type: 'text',
                    attrs: {
                        display_name: 'Department Head',
                        visibility: 'when_set',
                        managed: 'admin',
                    },
                },
                {
                    name: 'office',
                    type: 'text',
                    attrs: {
                        visibility: 'when_set',
                        managed: 'admin',
                    },
                },
            ];

            const fieldsMap = await setupCustomProfileAttributeFields(adminClient, seedAttributes);

            const policyName = `Display Name Selector ${pw.random.id()}`;
            let policyId: string | null = null;

            try {
                const {app} = await pw.testBrowser.login(adminUser);
                await setAbacEnabled(app, true);

                // # Open the new-policy form
                const policies = await openMembershipPolicies(app);
                await policies.addButton.click();
                const {policy} = app.admin.accessControl;
                await expect(policy.editPolicy.name.valueTextbox).toBeVisible();
                await policy.editPolicy.name.valueTextbox.fill(policyName);

                // # Add an attribute rule; its selector opens itself
                const row = policy.rules.row(0);
                await expect(policy.rules.addButton).toBeEnabled();
                await policy.rules.addButton.click();
                const {attributeMenu} = row;
                const deptHead = attributeMenu.attribute(fieldNamed(fieldsMap, 'dept_head'));
                const office = attributeMenu.attribute(fieldNamed(fieldsMap, 'office'));

                // * Both fields render: 'Department Head' (display_name, shown beside its identifier) and 'office' (name fallback)
                await expect(deptHead).toContainText('Department Head');
                await expect(office).toHaveText('office');

                // * Filter by display_name keeps only 'Department Head'
                await attributeMenu.filter.container.fill('department');
                await expect(deptHead).toBeVisible();
                await expect(office).toHaveCount(0);

                // * Filter by CEL identifier keeps only 'Department Head'
                await attributeMenu.filter.container.fill('dept_head');
                await expect(deptHead).toBeVisible();
                await expect(office).toHaveCount(0);

                // * Filter on the no-display_name field's `name` keeps only 'office'
                await attributeMenu.filter.container.fill('office');
                await expect(office).toBeVisible();
                await expect(deptHead).toHaveCount(0);

                // # Select 'Department Head'
                await attributeMenu.filter.container.fill('');
                await deptHead.click();

                // * The trigger button shows display_name, not the CEL identifier
                await expect(row.attributeButton).toContainText('Department Head');

                // # The rule is "is engineering"
                await expect(deptHead).not.toBeVisible();
                await expect(row.operatorButton).toContainMessage(Msg.admin.access_control.table_editor.operator.is);
                await fillRuleValue(row, 'engineering');

                // # Save
                await expect(app.admin.saveButton).toBeEnabled();
                await app.admin.saveButton.click();
                await expect(app.page).toHavePath(
                    `${app.adminConsolePage.pathFor()}/system_attributes/membership_policies`,
                );

                // * The persisted CEL uses the canonical identifier, not display_name
                policyId = await policyIdByName(adminClient, policyName);
                const saved = await adminClient.getAccessControlPolicy(policyId);

                const rules = (saved?.rules || []) as Array<{actions?: string[]; expression?: string}>;
                const membershipRule = rules.find((r) => r.actions?.includes('membership')) || rules[0];

                expect(membershipRule).toBeDefined();
                expect(membershipRule?.expression || '').toContain('user.attributes.dept_head');
                expect(membershipRule?.expression || '').not.toContain('Department Head');
            } finally {
                if (policyId) {
                    await deleteAccessControlPolicyIfPresent(adminClient, policyId);
                }

                await deleteCustomProfileAttributes(adminClient, fieldsMap);
            }
        },
    );
});
