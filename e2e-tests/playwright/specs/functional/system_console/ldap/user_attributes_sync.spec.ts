// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, openSystemConsoleSection, settle, Api, getRandomId, test, type App} from '@mattermost/playwright-lib';

/** Opens a System Console authentication page (`ldap`, `saml`), once its settings show. */
async function openAuthenticationPage(app: App, page: 'ldap' | 'saml') {
    await openSystemConsoleSection(app, `authentication/${page}`);
    await expect(app.admin.saveButton).toBeVisible();
}

/** Saves the page, and waits for the save to finish (Save disables again). */
async function save(app: App) {
    await expect(app.admin.saveButton).toBeEnabled();
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

    await expect(app.admin.saveButton).toBeSaved();
}

/**
 * @objective Verify the "User attributes sync" section on the AD/LDAP and SAML admin
 * settings pages correctly adds, edits, and clears sync values for regular text fields,
 * links a select field linked to a Global Attribute without converting its type, and
 * disables a linked field of a type sync cannot populate with an explanatory tooltip.
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

type LinkedField = {templateId: string; fieldId: string; name: string};

// A user field linked to a Global Attribute template of the given type.
async function createLinkedField(
    adminClient: Client4,
    prefix: string,
    type: 'select' | 'rank',
    options: Array<{name: string; rank?: number}>,
): Promise<LinkedField> {
    const template = await adminClient.createPropertyField(GROUP, TEMPLATE_OBJECT_TYPE, {
        name: `${prefix}_tmpl_${getRandomId()}`,
        type,
        target_type: 'system',
        target_id: '',
        attrs: {options: options.map((option) => ({id: '', ...option}))},
    } as Parameters<Client4['createPropertyField']>[2]);

    const name = `${prefix}_linked_${getRandomId()}`;
    const field = await adminClient.createPropertyField(GROUP, USER_OBJECT_TYPE, {
        name,
        type,
        target_type: 'system',
        target_id: '',
        linked_field_id: template.id,
    } as Parameters<Client4['createPropertyField']>[2]);
    return {templateId: template.id, fieldId: field.id, name};
}

async function deleteLinkedFieldQuietly(adminClient: Client4, linked: LinkedField): Promise<void> {
    await deleteFieldQuietly(adminClient, USER_OBJECT_TYPE, linked.fieldId);
    await deleteFieldQuietly(adminClient, TEMPLATE_OBJECT_TYPE, linked.templateId);
}

async function getUserField(adminClient: Client4, fieldId: string) {
    const fields = await adminClient.getPropertyFields(GROUP, USER_OBJECT_TYPE, {targetType: 'system'});
    return fields.find((field) => field.id === fieldId);
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
        const {app} = await pw.testBrowser.login(adminUser!);

        await openAuthenticationPage(app, 'ldap');
        const input = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();

        await input.fill('sAMAccountName');
        await expect(input).toHaveValue('sAMAccountName');
        await save(app);

        // # Reload and verify the value persisted
        await openAuthenticationPage(app, 'ldap');
        const reloadedInput = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(reloadedInput).toHaveValue('sAMAccountName');
    });

    test('edits an existing LDAP sync value and verifies the update persists after reload', async ({pw}) => {
        await setLdapAttr(adminClient, fieldId, 'oldAttr');

        const {adminUser} = await pw.getAdminClient();
        const {app} = await pw.testBrowser.login(adminUser!);

        await openAuthenticationPage(app, 'ldap');
        const input = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(input).toHaveValue('oldAttr');

        await input.fill('newAttr');
        await expect(input).toHaveValue('newAttr');
        await save(app);

        await openAuthenticationPage(app, 'ldap');
        await expect(app.admin.customProfileAttribute(fieldId).valueTextbox).toHaveValue('newAttr');
    });

    test('clears an LDAP sync value and verifies the field is empty after reload', async ({pw}) => {
        await setLdapAttr(adminClient, fieldId, 'toBeCleared');

        const {adminUser} = await pw.getAdminClient();
        const {app} = await pw.testBrowser.login(adminUser!);

        await openAuthenticationPage(app, 'ldap');
        const input = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(input).toHaveValue('toBeCleared');

        await input.clear();
        await expect(input).toHaveValue('');
        await save(app);

        await openAuthenticationPage(app, 'ldap');
        await expect(app.admin.customProfileAttribute(fieldId).valueTextbox).toHaveValue('');
    });

    test('links a linked select field without converting its type', async ({pw}) => {
        const linked = await createLinkedField(adminClient, 'sync_ldap', 'select', [
            {name: 'Engineering'},
            {name: 'Sales'},
        ]);

        try {
            const {adminUser} = await pw.getAdminClient();
            const {app} = await pw.testBrowser.login(adminUser!);

            await openAuthenticationPage(app, 'ldap');
            const input = app.admin.customProfileAttribute(linked.fieldId).valueTextbox;

            // * A select syncs as it is: the input is editable and warns of no conversion
            await expect(input).toBeEnabled();
            await expect(app.admin.customProfileAttribute(linked.fieldId).helpText).not.toContainText(
                'converted to a TEXT attribute',
            );

            // # Link it and save
            await input.fill('departmentNumber');
            await expect(input).toHaveValue('departmentNumber');
            await save(app);

            // * The link persists and the field is still a select
            await openAuthenticationPage(app, 'ldap');
            await expect(app.admin.customProfileAttribute(linked.fieldId).valueTextbox).toHaveValue('departmentNumber');
            const field = await getUserField(adminClient, linked.fieldId);
            expect(field?.type).toBe('select');
            expect(field?.attrs?.ldap).toBe('departmentNumber');
        } finally {
            await deleteLinkedFieldQuietly(adminClient, linked);
        }
    });

    test('shows a disabled input with a tooltip for a linked field of a type sync cannot populate', async ({pw}) => {
        const linked = await createLinkedField(adminClient, 'sync_ldap', 'rank', [
            {name: 'Low', rank: 1},
            {name: 'High', rank: 2},
        ]);

        try {
            const {adminUser} = await pw.getAdminClient();
            const {app} = await pw.testBrowser.login(adminUser!);

            await openAuthenticationPage(app, 'ldap');
            const input = app.admin.customProfileAttribute(linked.fieldId).valueTextbox;
            await expect(input).toBeVisible();

            // * Input is disabled - cannot be typed into
            await expect(input).toBeDisabled();

            // * Tooltip explains the field is linked to an attribute (scoped to avoid matching other linked fields on the page)
            await expect(app.admin.customProfileAttribute(linked.fieldId).helpText).toBeVisible();
            await expect(app.admin.customProfileAttribute(linked.fieldId).helpText).toContainText(
                'linked to an attribute of type rank',
            );
        } finally {
            await deleteLinkedFieldQuietly(adminClient, linked);
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
        const {app} = await pw.testBrowser.login(adminUser!);

        await openAuthenticationPage(app, 'saml');
        const input = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(input).toBeVisible();
        await expect(input).toBeEnabled();

        await input.fill('email');
        await expect(input).toHaveValue('email');
        await save(app);

        await openAuthenticationPage(app, 'saml');
        await expect(app.admin.customProfileAttribute(fieldId).valueTextbox).toHaveValue('email');
    });

    test('edits an existing SAML sync value and verifies the update persists after reload', async ({pw}) => {
        await setSamlAttr(adminClient, fieldId, 'oldSamlAttr');

        const {adminUser} = await pw.getAdminClient();
        const {app} = await pw.testBrowser.login(adminUser!);

        await openAuthenticationPage(app, 'saml');
        const input = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(input).toHaveValue('oldSamlAttr');

        await input.fill('newSamlAttr');
        await expect(input).toHaveValue('newSamlAttr');
        await save(app);

        await openAuthenticationPage(app, 'saml');
        await expect(app.admin.customProfileAttribute(fieldId).valueTextbox).toHaveValue('newSamlAttr');
    });

    test('clears a SAML sync value and verifies the field is empty after reload', async ({pw}) => {
        await setSamlAttr(adminClient, fieldId, 'toBeCleared');

        const {adminUser} = await pw.getAdminClient();
        const {app} = await pw.testBrowser.login(adminUser!);

        await openAuthenticationPage(app, 'saml');
        const input = app.admin.customProfileAttribute(fieldId).valueTextbox;
        await expect(input).toHaveValue('toBeCleared');

        await input.clear();
        await expect(input).toHaveValue('');
        await save(app);

        await openAuthenticationPage(app, 'saml');
        await expect(app.admin.customProfileAttribute(fieldId).valueTextbox).toHaveValue('');
    });

    test('links a linked select field without converting its type', async ({pw}) => {
        const linked = await createLinkedField(adminClient, 'sync_saml', 'select', [
            {name: 'Engineering'},
            {name: 'Sales'},
        ]);

        try {
            const {adminUser} = await pw.getAdminClient();
            const {app} = await pw.testBrowser.login(adminUser!);

            await openAuthenticationPage(app, 'saml');
            const input = app.admin.customProfileAttribute(linked.fieldId).valueTextbox;

            // * A select syncs as it is: the input is editable and warns of no conversion
            await expect(input).toBeEnabled();
            await expect(app.admin.customProfileAttribute(linked.fieldId).helpText).not.toContainText(
                'converted to a TEXT attribute',
            );

            // # Link it and save
            await input.fill('department');
            await expect(input).toHaveValue('department');
            await save(app);

            // * The link persists and the field is still a select
            await openAuthenticationPage(app, 'saml');
            await expect(app.admin.customProfileAttribute(linked.fieldId).valueTextbox).toHaveValue('department');
            const field = await getUserField(adminClient, linked.fieldId);
            expect(field?.type).toBe('select');
            expect(field?.attrs?.saml).toBe('department');
        } finally {
            await deleteLinkedFieldQuietly(adminClient, linked);
        }
    });

    test('shows a disabled input with a tooltip for a linked field of a type sync cannot populate', async ({pw}) => {
        const linked = await createLinkedField(adminClient, 'sync_saml', 'rank', [
            {name: 'Low', rank: 1},
            {name: 'High', rank: 2},
        ]);

        try {
            const {adminUser} = await pw.getAdminClient();
            const {app} = await pw.testBrowser.login(adminUser!);

            await openAuthenticationPage(app, 'saml');
            const input = app.admin.customProfileAttribute(linked.fieldId).valueTextbox;
            await expect(input).toBeVisible();

            await expect(input).toBeDisabled();
            await expect(app.admin.customProfileAttribute(linked.fieldId).helpText).toBeVisible();
            await expect(app.admin.customProfileAttribute(linked.fieldId).helpText).toContainText(
                'linked to an attribute of type rank',
            );
        } finally {
            await deleteLinkedFieldQuietly(adminClient, linked);
        }
    });
});
