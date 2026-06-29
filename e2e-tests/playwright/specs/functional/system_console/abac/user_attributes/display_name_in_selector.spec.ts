// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties';

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {getPolicyIdByName} from '../support';

type FieldsMap = Record<string, UserPropertyField>;

async function clearExistingFields(client: Client4): Promise<void> {
    try {
        const existing = await client.getCustomProfileAttributeFields();
        if (existing?.length) {
            const map: FieldsMap = {};
            for (const f of existing) {
                map[f.id] = f;
            }
            await deleteCustomProfileAttributes(client, map);
        }
    } catch {
        // No fields to clean up
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
            test.setTimeout(120000);

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
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;

                await navigateToABACPage(page);
                await enableABAC(page);

                // # Open the new-policy form
                await page.getByRole('button', {name: 'Add policy'}).click();
                await page.waitForLoadState('networkidle');

                const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
                await nameInput.waitFor({state: 'visible', timeout: 10000});
                await nameInput.fill(policyName);

                // # Add an attribute rule and open its selector
                const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
                await expect(addAttributeButton).toBeEnabled({timeout: 10000});
                await addAttributeButton.click();

                const attributeButton = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
                await attributeButton.waitFor({state: 'visible', timeout: 5000});

                const attributeMenu = page.locator('[id^="attribute-selector-menu"]');

                if (!(await attributeMenu.isVisible({timeout: 1000}).catch(() => false))) {
                    await attributeButton.click();
                }
                await attributeMenu.waitFor({state: 'visible', timeout: 5000});

                const deptHeadItem = page.locator('[id^="attribute-selector-menu"] li:has-text("Department Head")');
                const officeItem = page.locator('[id^="attribute-selector-menu"] li:has-text("office")');

                // * Both fields render: 'Department Head' (display_name) and 'office' (name fallback)
                await expect(deptHeadItem).toBeVisible();
                await expect(officeItem).toBeVisible();

                const filterInput = attributeMenu.locator('.attribute-selector-search input');
                await filterInput.waitFor({state: 'visible', timeout: 5000});

                // * Filter by display_name keeps only 'Department Head'
                await filterInput.fill('department');
                await expect(deptHeadItem).toBeVisible();
                await expect(officeItem).toHaveCount(0);

                // * Filter by CEL identifier keeps only 'Department Head'
                await filterInput.fill('');
                await filterInput.fill('dept_head');
                await expect(deptHeadItem).toBeVisible();
                await expect(officeItem).toHaveCount(0);

                // * Filter on the no-display_name field's `name` keeps only 'office'
                await filterInput.fill('');
                await filterInput.fill('office');
                await expect(officeItem).toBeVisible();
                await expect(deptHeadItem).toHaveCount(0);

                // # Select 'Department Head'
                await filterInput.fill('');
                await deptHeadItem.first().click({force: true});

                // * The trigger button shows display_name, not the CEL identifier
                await expect(attributeButton).toContainText('Department Head', {timeout: 5000});

                // # Wait for the attribute-selector popover to close before opening the next menu
                const attributeMenuPopover = page.locator('[id^="attribute-selector-menu"]');
                await attributeMenuPopover.waitFor({state: 'hidden', timeout: 5000});

                const operatorButton = page.locator('[data-testid="operatorSelectorMenuButton"]').first();
                await operatorButton.waitFor({state: 'visible', timeout: 5000});
                await operatorButton.click();

                const operatorMenu = page.locator('[id^="operator-selector-menu"]');
                await operatorMenu.waitFor({state: 'visible', timeout: 5000});
                await operatorMenu.locator('li:has-text("is")').first().click();

                const valueInput = page.locator('.values-editor__simple-input').first();
                await valueInput.waitFor({state: 'visible', timeout: 10000});
                await valueInput.fill('engineering');
                await valueInput.press('Tab');

                const saveButton = page.getByRole('button', {name: 'Save'});
                await expect(saveButton).toBeEnabled({timeout: 10000});

                // # Click Save and wait on the create-policy PUT (button unmounts on navigate)
                const createPolicyResponse = page.waitForResponse(
                    (r) => /\/access_control_policies(?:\?|$)/.test(r.url()) && r.request().method() === 'PUT',
                    {timeout: 15000},
                );
                await saveButton.click();
                const createResponse = await createPolicyResponse;
                expect(createResponse.ok()).toBe(true);

                await page.waitForURL(/\/admin_console\/system_attributes\/membership_policies/, {timeout: 10000});

                // * The persisted CEL uses the canonical identifier, not display_name
                policyId = await getPolicyIdByName(adminClient, policyName);
                expect(policyId).not.toBeNull();

                const policy = await (adminClient as any).doFetch(
                    `${adminClient.getBaseRoute()}/access_control_policies/${policyId}`,
                    {method: 'GET'},
                );

                const rules = (policy?.rules || []) as Array<{actions?: string[]; expression?: string}>;
                const membershipRule = rules.find((r) => r.actions?.includes('membership')) || rules[0];

                expect(membershipRule).toBeDefined();
                expect(membershipRule?.expression || '').toContain('user.attributes.dept_head');
                expect(membershipRule?.expression || '').not.toContain('Department Head');
            } finally {
                if (policyId) {
                    try {
                        await (adminClient as any).doFetch(
                            `${adminClient.getBaseRoute()}/access_control_policies/${policyId}`,
                            {method: 'DELETE'},
                        );
                    } catch {
                        // best-effort cleanup
                    }
                }

                await deleteCustomProfileAttributes(adminClient, fieldsMap);
            }
        },
    );
});
