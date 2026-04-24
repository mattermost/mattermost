// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared helpers for ABAC LDAP integration sync specs.
 * Tests for LDAP sync behavior with ABAC policies.
 */

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {activatePolicy} from '../support';

/**
 * Locate the policy row that was just created (by filling its unique ID suffix
 * into the search input), extract its policy ID from the `id` attribute of the
 * `.policy-name` element (which is formatted as `customDescription-<id>`), call
 * activatePolicy via the admin client, and then clear the search input so the
 * page returns to its initial state.
 *
 * Mirrors the exact sequence that was duplicated in all four LDAP spec files.
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
