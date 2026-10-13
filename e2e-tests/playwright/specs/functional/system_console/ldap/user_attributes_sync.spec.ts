// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the "User attributes sync" section on the AD/LDAP and SAML admin
 * settings pages correctly adds, edits, and clears sync values for regular text fields,
 * and that linked non-text fields are disabled with an explanatory tooltip.
 *
 * @precondition Enterprise license. No real LDAP or SAML server needed — the tests
 * exercise form save/reload behaviour only.
 */

const GROUP = 'access_control';
const USER_OBJECT_TYPE = 'user';
const TEMPLATE_OBJECT_TYPE = 'template';

async function createTextField(adminClient: Client4, name: string): Promise<any> {
    return adminClient.createPropertyField(GROUP, USER_OBJECT_TYPE, {
        name,
        type: 'text',
        target_type: 'system',
        target_id: '',
    } as Parameters<Client4['createPropertyField']>[2]);
}

async function setLdapAttr(adminClient: Client4, fieldId: string, value: string | null): Promise<void> {
    await adminClient.patchPropertyField(GROUP, USER_OBJECT_TYPE, fieldId, {attrs: {ldap: value}});
}

async function setSamlAttr(adminClient: Client4, fieldId: string, value: string | null): Promise<void> {
    await adminClient.patchPropertyField(GROUP, USER_OBJECT_TYPE, fieldId, {attrs: {saml: value}});
}

async function deleteFieldQuietly(adminClient: Client4, objectType: string, fieldId: string): Promise<void> {
    await adminClient.deletePropertyField(GROUP, objectType, fieldId).catch(() => {});
}

test.describe('User attributes sync — AD/LDAP settings page', () => {
    let adminClient: Client4;
    let fieldId: string;
    let fieldName: string;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;

        fieldName = `sync_ldap_${getRandomId()}`;
        const field = await createTextField(adminClient, fieldName);
        fieldId = field.id;
    });

    test.afterEach(async () => {
        await deleteFieldQuietly(adminClient, USER_OBJECT_TYPE, fieldId);
    });

    test('adds an LDAP sync value, saves, and verifies it persists after reload', async ({pw}) => {
        const {adminUser} = await pw.getAdminClient();
        const {systemConsolePage} = await pw.testBrowser.login(adminUser!);

        await systemConsolePage.gotoAdLdap();
        const input = systemConsolePage.page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();

        await input.fill('sAMAccountName');
        await systemConsolePage.adLdap.save();
        await systemConsolePage.adLdap.expectSaveComplete();

        // # Reload and verify the value persisted
        await systemConsolePage.gotoAdLdap();
        const reloadedInput = systemConsolePage.page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(reloadedInput).toHaveValue('sAMAccountName');
    });

    test('edits an existing LDAP sync value and verifies the update persists after reload', async ({pw}) => {
        await setLdapAttr(adminClient, fieldId, 'oldAttr');

        const {adminUser} = await pw.getAdminClient();
        const {systemConsolePage} = await pw.testBrowser.login(adminUser!);

        await systemConsolePage.gotoAdLdap();
        const input = systemConsolePage.page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(input).toHaveValue('oldAttr');

        await input.fill('newAttr');
        await systemConsolePage.adLdap.save();
        await systemConsolePage.adLdap.expectSaveComplete();

        await systemConsolePage.gotoAdLdap();
        await expect(systemConsolePage.page.getByTestId(`custom_profile_attribute-${fieldName}input`)).toHaveValue(
            'newAttr',
        );
    });

    test('clears an LDAP sync value and verifies the field is empty after reload', async ({pw}) => {
        await setLdapAttr(adminClient, fieldId, 'toBeCleared');

        const {adminUser} = await pw.getAdminClient();
        const {systemConsolePage} = await pw.testBrowser.login(adminUser!);

        await systemConsolePage.gotoAdLdap();
        const input = systemConsolePage.page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(input).toHaveValue('toBeCleared');

        await input.clear();
        await systemConsolePage.adLdap.save();
        await systemConsolePage.adLdap.expectSaveComplete();

        await systemConsolePage.gotoAdLdap();
        await expect(systemConsolePage.page.getByTestId(`custom_profile_attribute-${fieldName}input`)).toHaveValue('');
    });

    test('shows a disabled input with a tooltip for a linked non-text field', async ({pw}) => {
        const tmplName = `sync_ldap_tmpl_${getRandomId()}`;
        const linkedName = `sync_ldap_linked_${getRandomId()}`;
        let templateId = '';
        let linkedFieldId = '';

        const template = await adminClient.createPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, {
            name: tmplName,
            type: 'select',
            target_type: 'system',
            target_id: '',
            attrs: {
                options: [
                    {id: '', name: 'Red', color: '#FF0000'},
                    {id: '', name: 'Blue', color: '#0000FF'},
                ],
            },
        } as Parameters<Client4['createPropertyField']>[2]);
        templateId = template.id;

        const linkedField = await adminClient.createPropertyField(GROUP, USER_OBJECT_TYPE, {
            name: linkedName,
            type: 'select',
            target_type: 'system',
            target_id: '',
            linked_field_id: template.id,
        } as Parameters<Client4['createPropertyField']>[2]);
        linkedFieldId = linkedField.id;

        try {
            const {adminUser} = await pw.getAdminClient();
            const {systemConsolePage} = await pw.testBrowser.login(adminUser!);

            await systemConsolePage.gotoAdLdap();
            const input = systemConsolePage.page.getByTestId(`custom_profile_attribute-${linkedName}input`);
            await expect(input).toBeVisible();

            // * Input is disabled — cannot be typed into
            await expect(input).toBeDisabled();

            // * Tooltip explains this is a management attribute (scoped to avoid matching other linked fields on the page)
            await expect(
                systemConsolePage.page
                    .getByTestId(`custom_profile_attribute-${linkedName}help-text`)
                    .getByText('management attribute of type select'),
            ).toBeVisible();
        } finally {
            await deleteFieldQuietly(adminClient, USER_OBJECT_TYPE, linkedFieldId);
            await deleteFieldQuietly(adminClient, TEMPLATE_OBJECT_TYPE, templateId);
        }
    });
});

test.describe('User attributes sync — SAML settings page', () => {
    let adminClient: Client4;
    let fieldId: string;
    let fieldName: string;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;

        fieldName = `sync_saml_${getRandomId()}`;
        const field = await createTextField(adminClient, fieldName);
        fieldId = field.id;
    });

    test.afterEach(async () => {
        await deleteFieldQuietly(adminClient, USER_OBJECT_TYPE, fieldId);
    });

    test('adds a SAML sync value, saves, and verifies it persists after reload', async ({pw}) => {
        const {adminUser} = await pw.getAdminClient();
        const {page} = await pw.testBrowser.login(adminUser!);

        await page.goto('/admin_console/authentication/saml');
        const input = page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();

        await input.fill('email');
        await page.getByRole('button', {name: 'Save'}).click();
        await expect(page.getByRole('button', {name: 'Save'})).toBeDisabled();

        await page.goto('/admin_console/authentication/saml');
        await expect(page.getByTestId(`custom_profile_attribute-${fieldName}input`)).toHaveValue('email');
    });

    test('edits an existing SAML sync value and verifies the update persists after reload', async ({pw}) => {
        await setSamlAttr(adminClient, fieldId, 'oldSamlAttr');

        const {adminUser} = await pw.getAdminClient();
        const {page} = await pw.testBrowser.login(adminUser!);

        await page.goto('/admin_console/authentication/saml');
        const input = page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(input).toHaveValue('oldSamlAttr');

        await input.fill('newSamlAttr');
        await page.getByRole('button', {name: 'Save'}).click();
        await expect(page.getByRole('button', {name: 'Save'})).toBeDisabled();

        await page.goto('/admin_console/authentication/saml');
        await expect(page.getByTestId(`custom_profile_attribute-${fieldName}input`)).toHaveValue('newSamlAttr');
    });

    test('clears a SAML sync value and verifies the field is empty after reload', async ({pw}) => {
        await setSamlAttr(adminClient, fieldId, 'toBeCleared');

        const {adminUser} = await pw.getAdminClient();
        const {page} = await pw.testBrowser.login(adminUser!);

        await page.goto('/admin_console/authentication/saml');
        const input = page.getByTestId(`custom_profile_attribute-${fieldName}input`);
        await expect(input).toHaveValue('toBeCleared');

        await input.clear();
        await page.getByRole('button', {name: 'Save'}).click();
        await expect(page.getByRole('button', {name: 'Save'})).toBeDisabled();

        await page.goto('/admin_console/authentication/saml');
        await expect(page.getByTestId(`custom_profile_attribute-${fieldName}input`)).toHaveValue('');
    });

    test('shows a disabled input with a tooltip for a linked non-text field', async ({pw}) => {
        const tmplName = `sync_saml_tmpl_${getRandomId()}`;
        const linkedName = `sync_saml_linked_${getRandomId()}`;
        let templateId = '';
        let linkedFieldId = '';

        const template = await adminClient.createPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, {
            name: tmplName,
            type: 'select',
            target_type: 'system',
            target_id: '',
            attrs: {
                options: [
                    {id: '', name: 'Red', color: '#FF0000'},
                    {id: '', name: 'Blue', color: '#0000FF'},
                ],
            },
        } as Parameters<Client4['createPropertyField']>[2]);
        templateId = template.id;

        const linkedField = await adminClient.createPropertyField(GROUP, USER_OBJECT_TYPE, {
            name: linkedName,
            type: 'select',
            target_type: 'system',
            target_id: '',
            linked_field_id: template.id,
        } as Parameters<Client4['createPropertyField']>[2]);
        linkedFieldId = linkedField.id;

        try {
            const {adminUser} = await pw.getAdminClient();
            const {page} = await pw.testBrowser.login(adminUser!);

            await page.goto('/admin_console/authentication/saml');
            const input = page.getByTestId(`custom_profile_attribute-${linkedName}input`);
            await expect(input).toBeVisible();

            await expect(input).toBeDisabled();
            await expect(
                page
                    .getByTestId(`custom_profile_attribute-${linkedName}help-text`)
                    .getByText('management attribute of type select'),
            ).toBeVisible();
        } finally {
            await deleteFieldQuietly(adminClient, USER_OBJECT_TYPE, linkedFieldId);
            await deleteFieldQuietly(adminClient, TEMPLATE_OBJECT_TYPE, templateId);
        }
    });
});
