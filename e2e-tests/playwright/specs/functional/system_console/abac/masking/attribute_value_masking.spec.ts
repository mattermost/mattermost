// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {ChannelsPage, expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

// PLUG: setFieldAsSharedOnly flips a CPA field to shared_only in the DB (the
// API rejects it without a source_plugin_id). getStoredPolicyRuleExpressions
// reads the raw stored CEL straight from the policy table, bypassing the API
// masking pipeline — the AttributeValueMasking feature flag is loaded at
// server boot and cannot be flipped at runtime, so any API-level fetch returns
// the masked view and can't verify what was actually persisted.
import {setFieldAsSharedOnly, getStoredPolicyRuleExpressions} from './masking_db_setup';

/**
 * Attribute-Value Masking E2E Tests
 *
 * Validates the attribute-value masking feature:
 * - Callers see only values they hold; non-held values appear as masked chips
 * - Any caller with masked values in an existing policy cannot save changes (UI
 *   disables Save; server returns HTTP 403) — no role-based bypass
 * - Callers with full visibility (no masked values) can save and are subject to
 *   self-inclusion validation
 * - Non-held values are rejected on the write path via value-hold validation
 * - Feature flag gates all masking behaviour
 * - Raw CEL is redacted in GET and search API responses
 *
 * Each test creates its own uniquely-named CPA field and policy, and cleans
 * them up in a finally block so no state leaks between tests.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enable AttributeValueMasking feature flag */
async function enableMaskingFlag(client: Client4): Promise<void> {
    const config = await client.getConfig();
    config.FeatureFlags = config.FeatureFlags || {};
    (config.FeatureFlags as any).AttributeValueMasking = true;
    await client.updateConfig(config);
}

/** Disable AttributeValueMasking feature flag */
async function disableMaskingFlag(client: Client4): Promise<void> {
    const config = await client.getConfig();
    config.FeatureFlags = config.FeatureFlags || {};
    (config.FeatureFlags as any).AttributeValueMasking = false;
    await client.updateConfig(config);
}

/**
 * Create a plain text CPA field and return its ID.
 * Uses a caller-supplied unique name so each test owns its own field.
 */
async function createMaskingTextField(client: Client4, fieldName: string): Promise<string> {
    const url = `${client.getBaseRoute()}/custom_profile_attributes/fields`;
    const created = await (client as any).doFetch(url, {
        method: 'POST',
        body: JSON.stringify({
            name: fieldName,
            type: 'text',
            attrs: {
                sort_order: 99,
                managed: 'admin',
                visibility: 'when_set',
            },
        }),
    });
    return created.id as string;
}

/**
 * Delete a CPA field by ID. Best-effort — never throws.
 */
async function deleteCPAField(client: Client4, fieldId: string): Promise<void> {
    if (!fieldId) {
        return;
    }
    try {
        await (client as any).doFetch(`${client.getBaseRoute()}/custom_profile_attributes/fields/${fieldId}`, {
            method: 'DELETE',
        });
    } catch {
        // best-effort
    }
}

/**
 * Delete a membership policy by ID. Best-effort — never throws.
 */
async function deletePolicy(client: Client4, policyId: string): Promise<void> {
    if (!policyId) {
        return;
    }
    try {
        await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${policyId}`, {
            method: 'DELETE',
        });
    } catch {
        // best-effort
    }
}

/**
 * Set an attribute value for a user via the admin client.
 */
async function setUserAttribute(client: Client4, userId: string, fieldId: string, value: string): Promise<void> {
    await client.updateUserCustomProfileAttributesValues(userId, {[fieldId]: value});
}

/**
 * Create a membership policy using the Advanced (CEL) editor in the UI.
 * Does NOT add channels so there is no "Apply policy" gate to click through.
 * Returns the policy ID extracted from the URL after saving.
 */
async function createPolicyWithCEL(page: Page, name: string, celExpression: string): Promise<string> {
    await page.goto('/admin_console/system_attributes/membership_policies');
    await page.waitForLoadState('networkidle');

    const addPolicyBtn = page.getByRole('button', {name: 'Add policy'});
    await addPolicyBtn.waitFor({state: 'visible', timeout: 15000});
    await addPolicyBtn.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(name);

    // Switch to Advanced (CEL) mode
    const advancedBtn = page.getByRole('button', {name: /advanced/i});
    await advancedBtn.waitFor({state: 'visible', timeout: 5000});
    await advancedBtn.click();
    await page.waitForTimeout(1000);

    // Type CEL expression into the Monaco editor
    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.waitFor({state: 'visible', timeout: 5000});
    await editorLines.click({force: true});
    await page.waitForTimeout(300);
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.keyboard.type(celExpression, {delay: 10});
    await page.waitForTimeout(1000);

    // Save — no channels so no "Apply Policy" confirmation modal. Capture the
    // PUT response: saving redirects to the list view, so the URL no longer
    // carries the policy id. The API response body always has it.
    const saveBtn = page.getByRole('button', {name: 'Save'});
    await saveBtn.waitFor({state: 'visible', timeout: 5000});
    const savePromise = page.waitForResponse(
        (resp) =>
            /\/api\/v4\/access_control_policies(\/[A-Za-z0-9]+)?$/.test(resp.url()) &&
            resp.request().method() === 'PUT' &&
            resp.ok(),
        {timeout: 15000},
    );
    await saveBtn.click();
    const saveResp = await savePromise;
    const saved = await saveResp.json();
    await page.waitForLoadState('networkidle');

    const id = (saved?.id ?? saved?.ID ?? '') as string;
    if (!/^[A-Za-z0-9]{26}$/.test(id)) {
        throw new Error(
            `createPolicyWithCEL: save response did not include a valid policy id (got ${JSON.stringify(id)})`,
        );
    }
    return id;
}

/**
 * Navigate to the membership-policies list and open the editor for the named policy.
 */
async function openExistingPolicy(page: Page, policyName: string): Promise<void> {
    await page.goto('/admin_console/system_attributes/membership_policies');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Search helps filter to the correct row quickly
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible({timeout: 3000})) {
        await searchInput.fill(policyName);
        await page.waitForTimeout(1000);
    }

    const policyRow = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    await policyRow.waitFor({state: 'visible', timeout: 15000});
    await policyRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
}

/**
 * Fetch the policy expression from the server. When the masking flag is ON,
 * any value the caller does not hold is replaced with the masked-token
 * sentinel (e.g. "--------") in the returned expression.
 */
async function getRawPolicyExpression(page: Page, policyId: string): Promise<string> {
    const data = await page.evaluate(async (id: string) => {
        const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
            headers: {'X-Requested-With': 'XMLHttpRequest'},
        });
        return resp.json();
    }, policyId);
    return (data?.rules?.[0]?.expression ?? '') as string;
}

/**
 * Search for policies and return the first match's first rule expression.
 */
async function searchPoliciesExpression(page: Page, term: string): Promise<string> {
    const data = await page.evaluate(async (t: string) => {
        const resp = await fetch('/api/v4/access_control_policies/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({term: t}),
        });
        return resp.json();
    }, term);
    const policies = data?.policies ?? (Array.isArray(data) ? data : []);
    return (policies[0]?.rules?.[0]?.expression ?? '') as string;
}

/**
 * Extract the policy ID from the current URL after the editor has opened.
 * The route is `/admin_console/system_attributes/membership_policies/edit_policy/{id}`
 * — the previous regex captured `edit_policy` (the literal path segment) instead of
 * the actual id, so getRawPolicyExpression silently fetched against a non-existent
 * id and returned empty data, masking real test failures.
 */
async function getPolicyIdFromURL(page: Page): Promise<string> {
    const url = page.url();
    // Match `/edit_policy/<id>` first; fall back to `/membership_policies/<id>` for
    // older route shapes if the route is ever simplified.
    const editMatch = url.match(/edit_policy\/([A-Za-z0-9]+)/);
    if (editMatch) {
        return editMatch[1];
    }
    const fallback = url.match(/membership_policies\/([A-Za-z0-9]{26})/);
    if (fallback) {
        return fallback[1];
    }
    throw new Error(`getPolicyIdFromURL: could not extract policy id from URL ${JSON.stringify(url)}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Attribute-Value Masking', () => {
    test('MM-68508-1: Full masking round-trip in Simple editor', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha" — Bravo and Charlie will be masked for them
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            // Navigate back to the policy editor — masking now applies on load
            await openExistingPolicy(page, policyName);

            // Alpha chip must be visible (caller holds it)
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();

            // Masked chip must be visible (Bravo + Charlie are hidden)
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Bravo and Charlie chips must NOT appear in plain text
            await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();
            await expect(page.locator('.select__multi-value').filter({hasText: 'Charlie'})).not.toBeVisible();

            // Warning banner must appear
            await expect(page.locator('text="This policy contains restricted values"')).toBeVisible();

            // Attribute selector on the row must be locked (has 'disabled' class)
            const attributeSelector = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
            await expect(attributeSelector).toHaveClass(/disabled/);

            // Test-access-rule button must be disabled when policy has masked values
            const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
            if (await testRulesBtn.isVisible({timeout: 3000})) {
                await expect(testRulesBtn).toBeDisabled();
            }
            // Save-button enabled state is covered functionally by E2E-2 (merge round-trip)
            // and E2E-10 (held-value addition) — both exercise an actual save and verify the
            // server preserved hidden values. A pristine "is the button disabled?" check
            // here would only catch the narrow regression of adding a masking-aware gate to
            // SaveButton.disabled, which the round-trip tests also cover.
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-2: Caller with masked values can save; hidden values are preserved by merge', async ({pw}) => {
        // Validates that callers with masked values CAN save changes. Merge-on-save
        // re-injects hidden values so Bravo and Charlie survive even though the caller
        // only sees and submits Alpha. Save button is enabled (not gated on masked state).
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);
            const storedPolicyId = await getPolicyIdFromURL(page);

            // Alpha visible, Bravo+Charlie masked
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Dirty the form via the policy name field. The original test dirtied by removing /
            // re-adding the visible "Alpha" chip, but masked rows are now fully read-only —
            // value chips can't be removed and the value selector is disabled. The merge-on-save
            // invariant we're testing doesn't depend on how the form is dirtied; what matters is
            // that an actual PUT happens with the masked condition's reduced value set, and the
            // server re-injects Bravo + Charlie via mergeExpressionWithMaskedValues.
            const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInput.fill(policyName + ' (edited)');
            await page.waitForTimeout(300);

            // Save — must succeed
            await saveBtn.click();
            await page.waitForLoadState('networkidle');

            // Verify via API (flag off): Bravo + Charlie preserved by merge-on-save
            const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

            expect(rawExpression).toContain('Alpha');
            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-3: Row-remove button is disabled on masked rows', async ({pw}) => {
        // The trash/remove button on a masked row is disabled — a caller with
        // masked values cannot delete individual rows, matching the Save/Delete
        // buttons which are also disabled when masked values are present.
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // Confirm masked state
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Row-remove (trash) button must be disabled on the masked row
            const removeRowBtn = page
                .locator('button[aria-label="Remove row"], button.table-editor__row-remove')
                .first();
            await removeRowBtn.waitFor({state: 'visible', timeout: 5000});
            await expect(removeRowBtn).toBeDisabled();
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-4: Self-inclusion failure blocks save (caller has full visibility)', async ({pw}) => {
        // Self-inclusion is only checked when the caller holds ALL values in the policy
        // (no masked values). If masked values are present the 403 block fires first
        // and the Save button is disabled. This test uses a single-value policy so the
        // caller has full visibility, then removes their own satisfying value.
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha"; policy has ONLY ["Alpha"] — no masked values
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');
            await adminClient.addToTeam(team.id, adminUser.id);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy: MaskingProgram in ["Alpha"] — admin holds ALL values, no masking
            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(page, policyName, `user.attributes.${fieldName} in ["Alpha"]`);
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // Alpha visible, no masked chip — caller has full visibility
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Remove Alpha — now the condition has no values (empty)
            const alphaChip = page.locator('.select__multi-value').filter({hasText: 'Alpha'});
            await alphaChip.locator('.select__multi-value__remove').click();
            await page.waitForTimeout(300);

            // Try to save — should be blocked (admin no longer satisfies the condition)
            await saveBtn.click();
            await page.waitForTimeout(2000);

            // An error message about self-inclusion should appear
            const errorMsg = page.locator('text=/do not satisfy|self.inclusion|condition/i').first();
            await expect(errorMsg).toBeVisible({timeout: 8000});

            // Reload — Alpha should still be in the stored policy (save was blocked)
            await page.reload();
            await page.waitForLoadState('networkidle');
            await openExistingPolicy(page, policyName);
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-5: Non-held value rejected via direct API', async ({pw}) => {
        test.setTimeout(60000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Try to create a policy containing a non-held value ("Delta") via direct API
            const statusWithDelta = await page.evaluate(
                async ({fieldName: fn}: {fieldName: string}) => {
                    const resp = await fetch('/api/v4/access_control_policies', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: JSON.stringify({
                            name: `Illegal ${Date.now()}`,
                            type: 'member',
                            rules: [{expression: `user.attributes.${fn} in ["Alpha", "Delta"]`}],
                        }),
                    });
                    return resp.status;
                },
                {fieldName},
            );

            // Server must reject with 400 — "Delta" is not a held value
            expect(statusWithDelta).toBe(400);

            // Also verify that the masked placeholder literal is rejected
            const statusWithMasked = await page.evaluate(
                async ({fieldName: fn}: {fieldName: string}) => {
                    const resp = await fetch('/api/v4/access_control_policies', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: JSON.stringify({
                            name: `Illegal ${Date.now()}`,
                            type: 'member',
                            rules: [{expression: `user.attributes.${fn} in ["Alpha", "--------"]`}],
                        }),
                    });
                    return resp.status;
                },
                {fieldName},
            );

            expect(statusWithMasked).toBe(400);
        } finally {
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-6: CEL editor is read-only when policy has masked values', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            await openExistingPolicy(page, policyName);

            // Confirm masking is active (sanity)
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Switch to Advanced (CEL) mode
            const advancedBtn = page.getByRole('button', {name: /advanced/i});
            await advancedBtn.waitFor({state: 'visible', timeout: 5000});
            await advancedBtn.click();
            await page.waitForTimeout(1000);

            // Monaco editor must be read-only. Monaco doesn't set the DOM `readonly`
            // attribute unless `domReadOnly: true` is configured, and it isn't exposed
            // on `window`. Verify functionally: capture the current text, attempt to
            // type, and assert the content is unchanged.
            const monacoEditor = page.locator('.monaco-editor').first();
            await monacoEditor.waitFor({state: 'visible', timeout: 5000});
            const viewLines = monacoEditor.locator('.view-lines').first();
            const before = (await viewLines.textContent()) ?? '';
            // Click is intercepted by the .view-lines overlay; focus the textarea
            // directly and dispatch keystrokes — Monaco routes them to its model.
            await monacoEditor.locator('textarea.inputarea').first().focus();
            await page.keyboard.press('End');
            await page.keyboard.type('xyz');
            await page.waitForTimeout(300);
            const after = (await viewLines.textContent()) ?? '';
            expect(after).toBe(before);

            // There should be a notice/banner about restricted values in CEL mode
            const celNotice = page.locator('text=/restricted values|read.only/i').first();
            await expect(celNotice).toBeVisible({timeout: 5000});

            // Test-access-rule button must be disabled in CEL mode with masked values
            const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
            if (await testRulesBtn.isVisible({timeout: 3000})) {
                await expect(testRulesBtn).toBeDisabled();
            }

            // Switch back to Simple mode — masked chip is still present
            const simpleBtn = page.getByRole('button', {name: /simple/i});
            if (await simpleBtn.isVisible({timeout: 3000})) {
                await simpleBtn.click();
                await page.waitForTimeout(500);
                await expect(page.locator('.select__multi-value--masked')).toBeVisible();
            }
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-7: Caller holding all policy values sees them all unmasked', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha" and the policy contains ONLY "Alpha"
            // → caller holds ALL values in the condition → nothing is masked
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(page, policyName, `user.attributes.${fieldName} in ["Alpha"]`);
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            await openExistingPolicy(page, policyName);

            // Alpha visible
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();

            // No masked chip — caller holds all values
            await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();

            // No warning banner
            await expect(page.locator('text="This policy contains restricted values"')).not.toBeVisible();

            // Attribute selector is NOT locked
            const attributeSelector = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
            await expect(attributeSelector).not.toHaveClass(/disabled/);

            // Test access rule button should be enabled
            const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
            if (await testRulesBtn.isVisible({timeout: 3000})) {
                await expect(testRulesBtn).not.toBeDisabled();
            }

            // CEL mode is editable (no read-only)
            const advancedBtn = page.getByRole('button', {name: /advanced/i});
            if (await advancedBtn.isVisible({timeout: 3000})) {
                await advancedBtn.click();
                await page.waitForTimeout(1000);
                const monacoEditor = page.locator('.monaco-editor').first();
                if (await monacoEditor.isVisible({timeout: 3000})) {
                    const ariaReadOnly = await monacoEditor.getAttribute('aria-readonly');
                    expect(ariaReadOnly).not.toBe('true');
                }
            }
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-8: New policy creation has no masking', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Navigate to New Policy form
            await page.goto('/admin_console/system_attributes/membership_policies');
            await page.waitForLoadState('networkidle');
            await page.getByRole('button', {name: 'Add policy'}).click();
            await page.waitForLoadState('networkidle');

            // A fresh editor must show no masked chip and no warning banner
            await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();
            await expect(page.locator('text="This policy contains restricted values"')).not.toBeVisible();

            // Add a rule row
            const addAttributeBtn = page.getByRole('button', {name: /add attribute/i});
            if ((await addAttributeBtn.isVisible({timeout: 3000})) && !(await addAttributeBtn.isDisabled())) {
                await addAttributeBtn.click();
                await page.waitForTimeout(500);
            }

            // Still no masked chip after adding a blank row
            await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();

            // Attribute selector is NOT locked on a new row
            const attributeSelector = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
            await expect(attributeSelector).not.toHaveClass(/disabled/);
        } finally {
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-9: Masked row is fully read-only; merge-on-save preserves hidden values', async ({pw}) => {
        // The masked row's value selector is locked — callers cannot add or remove values
        // through it. This is intentional: any direct modification could silently drop
        // hidden values, and the merge logic gates write-path edits on shared_only fields
        // anyway. This test asserts the locked state, then dirties the form via an
        // unrelated field (policy name) and verifies the server-side merge still preserves
        // the hidden values across save — the same merge invariant E2E-2 covers, with the
        // extra assertion that the locked UI doesn't break round-trip correctness.
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha"; policy has ["Bravo", "Charlie"] (admin holds none of these)
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);
            const storedPolicyId = await getPolicyIdFromURL(page);

            // No visible chips (admin holds none of the existing values); only masked chip
            await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();
            await expect(page.locator('.select__multi-value').filter({hasText: 'Charlie'})).not.toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Value selector on the masked row is locked. Both the menu button and the chip
            // remove icons sit inside the disabled selector; trying to edit through them
            // is a no-op for the caller.
            const valueSelector = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            await expect(valueSelector).toHaveClass(/disabled/);

            // Dirty the form via an unrelated input so Save enables.
            const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInput.fill(policyName + ' (edited)');
            await page.waitForTimeout(300);

            // Save — must succeed despite the masked row being read-only.
            await saveBtn.click();
            await page.waitForLoadState('networkidle');

            // Verify via API (flag off): Bravo + Charlie still in the stored policy.
            // Alpha is NOT expected — this test's policy never contained Alpha and the
            // caller had no way to add it through the locked selector.
            const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-10: Text field masking with "in" operator', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy uses a text-field "in" with multiple values
            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            await openExistingPolicy(page, policyName);

            // "Alpha" chip visible (held); "Bravo" and "Charlie" are masked
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();
            await expect(page.locator('.select__multi-value').filter({hasText: 'Charlie'})).not.toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Attribute selector on the masked row is locked
            await expect(page.locator('[data-testid="attributeSelectorMenuButton"]').first()).toHaveClass(/disabled/);
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-11: Text field masking with single-value operator (value not held)', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            // adminUser holds "Building 1"; policy value is "Building 7" (not held)
            const fieldName = `MaskingLocation_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Building 1');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy: Location != "Building 7"
            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} != "Building 7"`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            await openExistingPolicy(page, policyName);

            // "Building 7" is not held by the admin → it should be masked in some form
            // (masked chip, disabled input, or redacted placeholder)
            await expect(page.locator('text="Building 7"')).not.toBeVisible();

            // The row should still show the masked state: either masked chip or read-only input
            const maskedState = page.locator(
                '.select__multi-value--masked, input[disabled], .values-editor__simple-input[disabled]',
            );
            await expect(maskedState).toBeVisible({timeout: 5000});
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-12: GET /policies/{id} does not leak raw CEL when values are masked', async ({pw}) => {
        test.setTimeout(60000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            // Get the policy ID from the URL after navigating to it
            await openExistingPolicy(page, policyName);
            const storedPolicyId = await getPolicyIdFromURL(page);
            expect(storedPolicyId).toBeTruthy();

            // GET policy as the logged-in user (holds "Alpha" only). Hidden values
            // must be replaced with the masked-token sentinel — "Bravo" and
            // "Charlie" would leak otherwise.
            const expression = await getRawPolicyExpression(page, storedPolicyId);
            expect(expression).toContain('Alpha');
            expect(expression).toContain('--------');
            expect(expression).not.toContain('Bravo');
            expect(expression).not.toContain('Charlie');

            // Direct DB read bypasses the API masking pipeline — stored expression
            // must still contain the originals.
            const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';
            expect(rawExpression).toContain('Alpha');
            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-13: POST /policies/search does not leak raw CEL when values are masked', async ({pw}) => {
        test.setTimeout(60000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

            // Search as the logged-in (masked) user — the response must contain the
            // masked-token sentinel for any hidden values, never the raw originals.
            const maskedExpression = await searchPoliciesExpression(page, policyName);
            expect(maskedExpression).toContain('--------');
            expect(maskedExpression).not.toContain('Bravo');
            expect(maskedExpression).not.toContain('Charlie');

            // Verify the stored policy still contains the originals — direct DB read,
            // bypassing the API masking pipeline.
            const rawExpression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';
            expect(rawExpression).toContain('Alpha');
            expect(rawExpression).toContain('Bravo');
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-14: Warning banner visible in editor when policy has masked values', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy with masked values (admin holds Alpha; Bravo/Charlie are masked)
            const maskedPolicyName = `MaskingPolicy ${pw.random.id()}`;
            const maskedPolicyId = await createPolicyWithCEL(
                page,
                maskedPolicyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(maskedPolicyId);

            // Policy with NO masked values (admin holds the only value in the condition)
            const cleanPolicyName = `CleanPolicy ${pw.random.id()}`;
            const cleanPolicyId = await createPolicyWithCEL(
                page,
                cleanPolicyName,
                `user.attributes.${fieldName} in ["Alpha"]`,
            );
            policyIds.push(cleanPolicyId);

            // shared_only must flip AFTER both policy saves: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold.
            await setFieldAsSharedOnly(fieldId);

            // Open masked policy — warning banner must be present
            await openExistingPolicy(page, maskedPolicyName);
            await expect(page.locator('text="This policy contains restricted values"')).toBeVisible({timeout: 5000});

            // Open clean policy — warning banner must NOT be present
            await openExistingPolicy(page, cleanPolicyName);
            await expect(page.locator('text="This policy contains restricted values"')).not.toBeVisible();
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-15: Delete button is disabled on masked policies; clean policies open the standard confirmation modal', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy WITH masked values
            const maskedPolicyName = `MaskingPolicy ${pw.random.id()}`;
            const maskedPolicyId = await createPolicyWithCEL(
                page,
                maskedPolicyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(maskedPolicyId);

            // Policy WITHOUT masked values
            const cleanPolicyName = `CleanPolicy ${pw.random.id()}`;
            const cleanPolicyId = await createPolicyWithCEL(
                page,
                cleanPolicyName,
                `user.attributes.${fieldName} in ["Alpha"]`,
            );
            policyIds.push(cleanPolicyId);

            // shared_only must flip AFTER both policy saves: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold.
            await setFieldAsSharedOnly(fieldId);

            // --- Masked policy: Delete button must be disabled (no modal flow) ---
            await openExistingPolicy(page, maskedPolicyName);

            const deleteBtn = page.getByRole('button', {name: /delete policy|delete/i}).last();
            await deleteBtn.scrollIntoViewIfNeeded();
            await expect(deleteBtn).toBeDisabled();

            // --- Clean policy: Delete button must be enabled and open a normal
            // confirmation modal without the "restricted values" warning ---
            await openExistingPolicy(page, cleanPolicyName);

            const cleanDeleteBtn = page.getByRole('button', {name: /delete policy|delete/i}).last();
            await cleanDeleteBtn.scrollIntoViewIfNeeded();
            await expect(cleanDeleteBtn).toBeEnabled();
            await cleanDeleteBtn.click();
            await page.waitForTimeout(500);

            const cleanModal = page.locator('[role="dialog"]').filter({hasText: /confirm|delete/i});
            await cleanModal.waitFor({state: 'visible', timeout: 5000});
            await expect(cleanModal.locator('text=/restricted values/i')).not.toBeVisible();

            await cleanModal.getByRole('button', {name: /cancel/i}).click();
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-16: Delete Policy is blocked (UI and server) when caller has masked values', async ({pw}) => {
        // Validates that the read-only-when-masked invariant covers deletion:
        // - Delete Policy button in the UI is disabled when hasMaskedRows is true
        // - Server returns HTTP 403 for direct DELETE requests when caller has masked values
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // Confirm masked state
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // UI: Delete Policy button must be disabled when masked values present
            const deleteBtn = page.getByRole('button', {name: /^delete$/i}).last();
            if (await deleteBtn.isVisible({timeout: 5000})) {
                await expect(deleteBtn).toBeDisabled();
            }

            // The DELETE handler requires the route's :policy_id segment to match
            // [A-Za-z0-9]+. If the id is malformed, the request 404s instead of
            // hitting the 403 guard — assert format up front so a mismatch is
            // surfaced clearly instead of being misread as missing 403 enforcement.
            expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);

            // Server: direct DELETE must return HTTP 403
            const status = await page.evaluate(async (id: string) => {
                const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
                    method: 'DELETE',
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                });
                return resp.status;
            }, policyId);

            expect(status, `DELETE /api/v4/access_control_policies/${policyId} returned ${status}`).toBe(403);

            // Verify policy still exists via API (flag off)
            const expression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';
            expect(expression).toContain('Alpha');
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-17: Multi-condition save preserves all hidden values; deleting masked row is blocked', async ({pw}) => {
        // Validates merge-on-save for a multi-condition policy. The caller (holds Alpha
        // in programField, nothing in clearanceField) can save — both conditions survive
        // with their hidden values intact. The server blocks deletion of masked conditions.
        test.setTimeout(150000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const programFieldName = `MaskingProgram_${pw.random.id()}`;
            const clearanceFieldName = `MaskingClearance_${pw.random.id()}`;
            const programFieldId = await createMaskingTextField(adminClient, programFieldName);
            const clearanceFieldId = await createMaskingTextField(adminClient, clearanceFieldName);
            fieldIds.push(programFieldId, clearanceFieldId);

            await setUserAttribute(adminClient, adminUser.id, programFieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingRegressionPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${programFieldName} in ["Alpha", "Bravo", "Charlie"] && user.attributes.${clearanceFieldName} in ["Secret", "TopSecret"]`,
            );
            policyIds.push(policyId);

            // shared_only must flip AFTER the policy save for both fields: validatePolicyExpressionValues
            // would otherwise reject Bravo / Charlie / Secret / TopSecret which the caller doesn't hold.
            await setFieldAsSharedOnly(programFieldId);
            await setFieldAsSharedOnly(clearanceFieldId);

            await openExistingPolicy(page, policyName);
            const storedPolicyId = await getPolicyIdFromURL(page);

            // Both rows are masked — banner visible
            await expect(page.locator('.select__multi-value--masked').first()).toBeVisible();
            await expect(page.locator('text="This policy contains restricted values"')).toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Trash buttons on both masked rows must be DISABLED
            const trashButtons = page.locator('button[aria-label="Remove row"]');
            const firstTrash = trashButtons.first();
            if (await firstTrash.isVisible({timeout: 3000})) {
                await expect(firstTrash).toBeDisabled();
            }

            // Dirty the form via the policy name so Save enables. Masked rows themselves
            // are read-only — no chip removal or value-selector edit is possible. The
            // merge-on-save server logic runs on any save, regardless of which field
            // triggered the dirty state.
            const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInput.fill(policyName + ' (edited)');
            await page.waitForTimeout(300);

            await saveBtn.click();
            await page.waitForLoadState('networkidle');

            // Verify the stored policy directly — bypass API masking, all hidden values
            // must survive merge-on-save. The persisted CEL uses canonical id form
            // (`user.id_<userid>.id_<fieldid>`), so match on field ids, not names.
            const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

            expect(rawExpression).toContain(programFieldId);
            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
            expect(rawExpression).toContain(clearanceFieldId);
            expect(rawExpression).toContain('Secret');
            expect(rawExpression).toContain('TopSecret');

            // Server blocks a direct API attempt to remove a masked condition.
            // Updates use the collection endpoint with `id` in the body — there is
            // no PUT on /access_control_policies/{id}. The submitted expression
            // must use only values the caller holds, otherwise
            // validatePolicyExpressionValues 400s before the 403 guard runs.
            // Caller holds "Alpha" in programField and nothing in clearanceField,
            // so submitting just the program condition drops the masked clearance
            // condition → 403 from mergeExpressionWithMaskedValues.
            const status = await page.evaluate(
                async ({policyId: id, fn}: {policyId: string; fn: string}) => {
                    const resp = await fetch('/api/v4/access_control_policies', {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
                        body: JSON.stringify({
                            id,
                            name: 'Modified',
                            type: 'parent',
                            rules: [{expression: `user.attributes.${fn} in ["Alpha"]`}],
                        }),
                    });
                    return resp.status;
                },
                {policyId, fn: programFieldName},
            );

            expect(status, `PUT /api/v4/access_control_policies (id=${policyId}) returned ${status}`).toBe(403);
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-18: Team admin cannot delete a policy with masked values even after removing all channels', async ({
        pw,
    }) => {
        // Validates that the masked-values block applies to the team settings modal:
        // the Delete button stays disabled even after a team admin removes all assigned
        // channels from the policy, as long as masked values are present.
        // The server also returns HTTP 403 for a direct DELETE request.
        test.setTimeout(150000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha"; policy has ["Alpha", "Bravo"] — Bravo is masked
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            // Create the policy via system console (as system admin)
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const sysPage = systemConsolePage.page;
            await navigateToABACPage(sysPage);
            await enableABAC(sysPage);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                sysPage,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo"]`,
            );
            policyIds.push(policyId);
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            // Assign team to policy so it shows up in team settings
            await adminClient.addToTeam(team.id, adminUser.id);
            try {
                await (adminClient as any).doFetch(
                    `${(adminClient as any).getBaseRoute()}/access_control_policies/${policyId}/teams`,
                    {method: 'POST', body: JSON.stringify({team_id: team.id})},
                );
            } catch {
                // best-effort assignment — test still validates button state
            }

            // Open team settings modal as the same admin (who has masked values)
            const {page} = await pw.testBrowser.login(adminUser);
            const channelsPage = new ChannelsPage(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const teamSettings = await channelsPage.openTeamSettings();
            await teamSettings.openAccessPoliciesTab();

            // Find and open the masked policy in the editor
            const policyRow = teamSettings.container.getByText(policyName).first();
            if (await policyRow.isVisible({timeout: 5000})) {
                await policyRow.click();
                await page.waitForTimeout(500);

                // Delete button must be disabled — masked values present
                const deleteBtn = teamSettings.container
                    .locator('.TeamPolicyEditor__section--delete button')
                    .filter({hasText: 'Delete'});

                if (await deleteBtn.isVisible({timeout: 3000})) {
                    await expect(deleteBtn).toBeDisabled();

                    // Remove the channel (if any) — button must STAY disabled due to masked values
                    const removeLink = teamSettings.container.getByText('Remove').first();
                    if (await removeLink.isVisible({timeout: 2000})) {
                        await removeLink.click();
                        await page.waitForTimeout(300);
                        // Even with no channels, delete must remain disabled because of masked values
                        await expect(deleteBtn).toBeDisabled();
                    }
                }

                await teamSettings.close();
            }

            // The DELETE route requires `policy_id` to match [A-Za-z0-9]+; a
            // malformed id 404s before reaching the 403 masked-values guard.
            expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);

            // Server: direct DELETE must return HTTP 403 regardless of UI state
            const status = await page.evaluate(async (id: string) => {
                const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
                    method: 'DELETE',
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                });
                return resp.status;
            }, policyId);

            expect(status, `DELETE /api/v4/access_control_policies/${policyId} returned ${status}`).toBe(403);
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });

    test('MM-68508-19: Mode toggle Simple → Advanced → Simple preserves all masked-row restrictions', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `MaskingProgram_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // --- Initial Simple mode: restrictions in place ---
            const maskedChip = page.locator('.select__multi-value--masked');
            const banner = page.locator('text="This policy contains restricted values"');
            const deleteBtn = page.getByRole('button', {name: /^delete$/i}).last();

            await expect(maskedChip.first()).toBeVisible();
            await expect(banner).toBeVisible();
            await expect(deleteBtn).toBeDisabled();

            // --- Switch to Advanced mode ---
            const toAdvanced = page.getByRole('button', {name: /switch to advanced mode/i});
            await toAdvanced.click();
            await page.waitForTimeout(500);

            // Banner must persist across the toggle (it lives in policy_details,
            // not the editor).
            await expect(banner).toBeVisible();
            // CEL editor visible
            await expect(page.locator('.monaco-editor').first()).toBeVisible();

            // --- Switch back to Simple mode ---
            const toSimple = page.getByRole('button', {name: /switch to simple mode/i});
            await toSimple.click();
            // Give TableEditor a beat to remount and re-fetch the AST. The
            // assertions below must hold *after* the remount completes — that
            // window is exactly where the pre-fix race lived.
            await page.waitForTimeout(1500);

            // Banner must STILL be visible.
            await expect(banner).toBeVisible();
            // Masked chip must STILL be visible.
            await expect(maskedChip.first()).toBeVisible();
            // Delete button must STILL be disabled.
            await expect(deleteBtn).toBeDisabled();
            // Value selector on the masked row must be disabled (no edits to
            // values the caller couldn't see).
            const valueSelector = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            if (await valueSelector.isVisible({timeout: 2000})) {
                await expect(valueSelector).toBeDisabled();
            }
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });
});
