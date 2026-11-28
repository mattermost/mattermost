// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration, Msg} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';
import {openMembershipPolicies, setAbacEnabled, setCelExpression} from '../surface';

import {
    createMaskingMultiselectField,
    createMaskingTextField,
    createPolicyWithCEL,
    enableMaskingFlag,
    MaskingCleanup,
    openMaskedPolicy,
    setUserAttribute,
} from './masking_helpers';
import {purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';

const fieldPrefix = 'MaskingVT';

test.describe('Attribute-Value Masking - Visibility and Text Fields', {tag: ['@abac', '@abac_masking']}, () => {
    test.beforeAll(async () => {
        await purgeFieldsByPrefix(fieldPrefix);
    });

    // Cleanup runs after the test, so a cleanup failure never hides the test's own failure.
    const cleanup = new MaskingCleanup();
    test.afterEach(async () => {
        await cleanup.run();
    });

    test('MM-68508-7: Caller holding all policy values sees them all unmasked', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const {fieldIds, policyIds} = cleanup.track(adminClient);

        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);

        // adminUser holds "Alpha" and the policy contains ONLY "Alpha"
        // → caller holds ALL values in the condition → nothing is masked
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {app} = await pw.testBrowser.login(adminUser);
        const expression = `user.attributes.${fieldName} in ["Alpha"]`;
        const policyId = await createPolicyWithCEL(app, adminClient, `MaskingPolicy ${pw.random.id()}`, expression);
        policyIds.push(policyId);
        await setFieldAsSharedOnly(fieldId);

        const {policy, row} = await openMaskedPolicy(app, policyId);

        // * Alpha is the row's only value, and nothing is masked
        await expect(await row.value.chipList.itemWith({text: 'Alpha'})).toBeVisible();
        await expect(await row.value.chipList.itemWith({text: 'Alpha'})).toContainText('Alpha');
        await expect(row.value.chipList).toHaveKeyCount(1);
        await expect(row.maskedImg).toHaveCount(0);
        await expect(policy.maskedValuesWarning).toHaveCount(0);

        // * The attribute selector and the access test are usable
        await expect(row.attributeButton).toBeEnabled();
        await expect(policy.rules.testButton).toBeVisible();
        await expect(policy.rules.testButton).toBeEnabled();

        // * The CEL editor takes a new expression (it isn't read-only)
        await setCelExpression(app, policy, `${expression} && true`);
        await expect(policy.cel.input).toContainText('&& true');
        await expect(policy.cel.maskedAlert).toHaveCount(0);
    });

    test('MM-68508-8: New policy creation has no masking', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const {fieldIds} = cleanup.track(adminClient);

        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // # Open the New Policy form
        const policies = await openMembershipPolicies(app);
        await policies.addButton.click();
        const {policy} = app.admin.accessControl;
        await expect(policy.editPolicy.name.valueTextbox).toBeVisible();

        // * A fresh editor shows no warning banner
        await expect(policy.maskedValuesWarning).toHaveCount(0);

        // # Add a rule row
        await expect(policy.rules.addButton).toBeEnabled();
        await policy.rules.addButton.click();
        const row = policy.rules.row(0);
        await expect(row.attributeButton).toBeVisible();

        // * Still nothing masked after adding a blank row, and its attribute selector is not locked
        await expect(row.maskedImg).toHaveCount(0);
        await expect(row.attributeButton).toBeEnabled();
    });

    test('MM-68508-9: Masked row is fully read-only', async ({pw}) => {
        // The masked row's value selector is locked — callers cannot add or remove values
        // through it. This is intentional: any direct modification could silently drop
        // hidden values, and the merge logic gates write-path edits on shared_only fields.
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const {fieldIds, policyIds} = cleanup.track(adminClient);

        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {app} = await pw.testBrowser.login(adminUser);
        const policyId = await createPolicyWithCEL(
            app,
            adminClient,
            `MaskingPolicy ${pw.random.id()}`,
            `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
        );
        policyIds.push(policyId);
        await setFieldAsSharedOnly(fieldId);

        const {row} = await openMaskedPolicy(app, policyId);

        // * Masked state visible
        await expect(row.maskedImg).toBeVisible();

        // * The value and attribute selectors on the masked row are disabled
        await expect(row.value.container).toBeVisible();
        await expect(row.value.container).toBeDisabled();
        await expect(row.attributeButton).toBeDisabled();
    });

    test('MM-68508-10: Text field masking with "in" operator', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const {fieldIds, policyIds} = cleanup.track(adminClient);

        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {app} = await pw.testBrowser.login(adminUser);
        const policyId = await createPolicyWithCEL(
            app,
            adminClient,
            `MaskingPolicy ${pw.random.id()}`,
            `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
        );
        policyIds.push(policyId);
        await setFieldAsSharedOnly(fieldId);

        const {row} = await openMaskedPolicy(app, policyId);

        // * "Alpha" (held) is the only value shown; "Bravo" and "Charlie" sit behind the masked chip
        await expect(await row.value.chipList.itemWith({text: 'Alpha'})).toContainText('Alpha');
        await expect(row.value.chipList).toHaveKeyCount(1);
        await expect(row.maskedImg).toBeVisible();
        await expect(row).not.toContainText('Bravo');
        await expect(row).not.toContainText('Charlie');

        // * The attribute selector on the masked row is locked
        await expect(row.attributeButton).toBeDisabled();
    });

    test('MM-68508-11: Text field masking with single-value operator (value not held)', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const {fieldIds, policyIds} = cleanup.track(adminClient);

        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        // adminUser holds "Building 1"; policy value is "Building 7" (not held)
        const fieldName = `${fieldPrefix}Loc_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Building 1');

        const {app} = await pw.testBrowser.login(adminUser);

        // Policy: Location != "Building 7"
        const policyId = await createPolicyWithCEL(
            app,
            adminClient,
            `MaskingPolicy ${pw.random.id()}`,
            `user.attributes.${fieldName} != "Building 7"`,
        );
        policyIds.push(policyId);
        await setFieldAsSharedOnly(fieldId);

        const {policy, row} = await openMaskedPolicy(app, policyId);

        // * "Building 7" is not held by the admin, so the row shows only the masked chip
        await expect(row.maskedImg).toBeVisible();
        await expect(policy.maskedValuesWarning).toBeVisible();
        await expect(row).not.toContainText('Building 7');
    });

    test('MM-68508-22: Fully-masked hasAnyOf row displays correct operator', async ({pw}) => {
        // Regression test for: when a caller holds none of the values in a
        // hasAnyOf condition, all values are replaced by a single masked-token
        // sentinel. The masked expression re-parses to a standalone "tok in attr"
        // which mergeMultiselectConditions promotes to hasAllOf — showing the wrong
        // operator in the table editor. The fix emits a duplicate-token OR to
        // preserve hasAnyOf semantics through the re-parse cycle.
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const {fieldIds, policyIds} = cleanup.track(adminClient);

        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `${fieldPrefix}Team_${pw.random.id()}`;
        const fieldId = await createMaskingMultiselectField(adminClient, fieldName, ['Alpha', 'Bravo']);
        fieldIds.push(fieldId);

        // adminUser holds NONE of the values — the entire condition is fully masked.

        const {app} = await pw.testBrowser.login(adminUser);

        // Policy uses hasAnyOf: ("Alpha" in attr || "Bravo" in attr)
        const policyId = await createPolicyWithCEL(
            app,
            adminClient,
            `MaskingPolicy ${pw.random.id()}`,
            `("Alpha" in user.attributes.${fieldName} || "Bravo" in user.attributes.${fieldName})`,
        );
        policyIds.push(policyId);

        await setFieldAsSharedOnly(fieldId);

        const {row} = await openMaskedPolicy(app, policyId);

        // * Only the masked chip shows — the caller holds no values
        await expect(row.maskedImg).toBeVisible();
        await expect(row.value.chipList).toHaveKeyCount(0);

        // * The operator on the masked row reads "has any of", not "has all of"
        await expect(row.operatorButton).toContainMessage(Msg.admin.access_control.table_editor.operator.has_any_of);
        await expect(row.operatorButton).not.toContainMessage(
            Msg.admin.access_control.table_editor.operator.has_all_of,
        );
    });
});
