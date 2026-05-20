// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

import {getStoredPolicyRuleExpressions, purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';
import {
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    getPolicyIdFromURL,
    getRawPolicyExpression,
    openExistingPolicy,
    searchPoliciesExpression,
    setUserAttribute,
} from './support';

/**
 * Attribute-Value Masking — text-field single-value masking, GET/search API
 * redaction, and warning-banner visibility.
 */

test.beforeAll(async () => {
    await purgeFieldsByPrefix('Masking');
});

test('MM-68508-11: Text field masking with single-value operator (value not held)', async ({pw}) => {
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
        const policyId = await createPolicyWithCEL(page, policyName, `user.attributes.${fieldName} != "Building 7"`);
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
        await expect(maskedState).toBeVisible();
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
        await expect(page.locator('text="This policy contains restricted values"')).toBeVisible();

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
