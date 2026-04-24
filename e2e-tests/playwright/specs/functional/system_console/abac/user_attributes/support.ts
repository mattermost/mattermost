// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared helpers for ABAC user-attribute change specs.
 * Tests for user attribute changes affecting ABAC policies.
 */

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {activatePolicy} from '../support';

/**
 * Search for the newly-created policy by its unique-ID suffix, read the policy
 * ID out of the `.policy-name` row (`id` attribute is formatted as
 * `customDescription-<id>`), activate it through the admin client, then clear
 * the search input.
 */
export async function activatePolicyByName(page: Page, adminClient: Client4, policyName: string): Promise<void> {
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 5000});

    const idMatch = policyName.match(/([a-z0-9]+)$/i);
    const uniqueId = idMatch ? idMatch[1] : policyName;
    await searchInput.fill(uniqueId);
    await page.waitForTimeout(1000);

    const policyRow = page.locator('.policy-name').first();
    const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
    if (policyId) {
        await activatePolicy(adminClient, policyId);
    }
    await searchInput.clear();
}
