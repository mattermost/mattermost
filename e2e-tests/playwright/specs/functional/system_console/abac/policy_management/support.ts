// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared helpers for ABAC policy-management edit specs.
 * Tests for editing existing ABAC policies.
 */

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {enableUserManagedAttributes} from '../support';

/**
 * Delete every existing custom profile attribute field, enable user-managed
 * attributes, then create fresh `Department` and `Office` text attributes.
 * Returns an attributeFieldsMap keyed by each field's id so it can be passed
 * into createUserForABAC.
 */
export async function resetAndCreateDepartmentOfficeAttributes(adminClient: Client4): Promise<Record<string, any>> {
    // Delete ALL existing custom attributes to start fresh
    try {
        const existingFields = await adminClient.getCustomProfileAttributeFields();
        for (const field of existingFields) {
            try {
                await adminClient.deleteCustomProfileAttributeField(field.id);
            } catch {
                // Ignore deletion errors
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch {
        // Ignore if no fields exist
    }

    // Enable user-managed attributes FIRST (same pattern as MM-T5783)
    await enableUserManagedAttributes(adminClient);

    // create attributes using direct API
    const attributeFieldsMap: Record<string, any> = {};

    const departmentField = await (adminClient as any).createCustomProfileAttributeField({
        name: 'Department',
        type: 'text',
        attrs: {managed: 'admin', visibility: 'when_set', sort_order: 0},
    });
    attributeFieldsMap[departmentField.id] = departmentField;

    const officeField = await (adminClient as any).createCustomProfileAttributeField({
        name: 'Office',
        type: 'text',
        attrs: {managed: 'admin', visibility: 'when_set', sort_order: 1},
    });
    attributeFieldsMap[officeField.id] = officeField;

    // Wait for attributes to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return attributeFieldsMap;
}

/**
 * Navigate to the Membership Policies list page and open the row for the named
 * policy (searching if the row is not already on-screen), then wait for
 * navigation to the edit page to settle.
 */
export async function openPolicyForEdit(page: Page, policyName: string): Promise<void> {
    await page.goto('/admin_console/system_attributes/membership_policies', {waitUntil: 'networkidle'});
    await page.waitForTimeout(2000);

    // Verify we're on the list page by checking for "Add policy" button
    const addPolicyButton = page.getByRole('button', {name: 'Add policy'});
    await addPolicyButton.waitFor({state: 'visible', timeout: 10000});

    // Try to find the policy row first without search
    const policyRowLocator = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    const isPolicyVisible = await policyRowLocator.isVisible({timeout: 3000}).catch(() => false);

    // If not visible, use search
    if (!isPolicyVisible) {
        const policySearchInput = page
            .locator('.DataGrid input[type="text"], input[placeholder*="Search policies" i]')
            .first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.click();
            await policySearchInput.fill(policyName);
            await page.waitForTimeout(1500);
        }
    }

    // Click policy to edit
    await policyRowLocator.waitFor({state: 'visible', timeout: 15000});
    await policyRowLocator.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
}
