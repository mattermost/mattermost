// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for System Console > User Attributes page.
 *
 * Tests the admin UI for managing Custom Profile Attribute (CPA) field definitions,
 * including creating, editing, deleting, and configuring attribute fields.
 *
 * Related: MM-62558 / PR #30722 (Profile Popup CPA tests pattern reference)
 */

import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test, SystemConsolePage} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    setupCustomProfileAttributeFields,
    deleteCustomProfileAttributes,
    CustomProfileAttribute,
} from '../../channels/custom_profile_attributes/helpers';

type FieldsMap = Record<string, UserPropertyField>;

interface TestContext {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
}

async function setupTest(pw: PlaywrightExtended): Promise<TestContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();

    // # Clean up any pre-existing CPA fields to start with a blank slate
    try {
        const existing = await adminClient.getCustomProfileAttributeFields();
        if (existing?.length) {
            const existingMap: FieldsMap = {};
            for (const f of existing) {
                existingMap[f.id] = f;
            }
            await deleteCustomProfileAttributes(adminClient, existingMap);
        }
    } catch {
        // No fields to clean up
    }

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, systemConsolePage};
}

async function getFieldsMap(client: Client4): Promise<FieldsMap> {
    const fields: UserPropertyField[] = await client.getCustomProfileAttributeFields();
    const map: FieldsMap = {};
    for (const field of fields) {
        map[field.id] = field;
    }
    return map;
}

async function cleanupFields(client: Client4, fieldsMap: FieldsMap): Promise<void> {
    if (Object.keys(fieldsMap).length > 0) {
        await deleteCustomProfileAttributes(client, fieldsMap);
    }
}

test.describe('System Console - User Attributes Management', () => {
    /**
     * @objective Verify that navigating to the User Attributes page shows the empty state
     * with the Add attribute button and a disabled Save button.
     */
    test('navigates to user attributes page and displays empty state', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes via sidebar
        await systemConsolePage.sidebar.systemAttributes.userAttributes.click();

        // * Verify the page loaded
        await sp.toBeVisible();

        // * Verify the "Add attribute" link button is visible
        await expect(sp.addAttributeButton).toBeVisible();

        // * Verify Save button is present but disabled (no changes)
        await expect(sp.saveButton).toBeVisible();
        await expect(sp.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify that attributes created via API are displayed in the table
     * when the User Attributes page loads.
     *
     * @precondition
     * Two custom profile attributes (Department, Role) exist via API setup.
     */
    test('displays pre-existing attributes in the table', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Set up attributes via API
        const attributes: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text'},
            {name: 'Role', type: 'text', attrs: {value_type: 'url'}},
        ];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify attributes appear in the table
        await expect(sp.nameInputByValue('Department')).toBeVisible();
        await expect(sp.nameInputByValue('Role')).toBeVisible();

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify creating a new text attribute via the UI and saving it
     * persists the field to the server.
     */
    test.fixme('creates a new text attribute and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Click "Add attribute"
        await sp.addAttribute();

        // * Verify a new row with an input appears in the table
        const nameInput = sp.nameInput(0);
        await expect(nameInput).toBeVisible();

        // # Type attribute name
        await nameInput.fill('Test Department');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify the field was created by fetching from API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'Test Department');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('text');

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify creating a select attribute with multiple options saves
     * the field and its options to the server.
     */
    test.fixme('creates a select attribute with options and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Click "Add attribute"
        await sp.addAttribute();

        // # Type attribute name
        const nameInput = sp.nameInput(0);
        await nameInput.fill('Office Location');
        await nameInput.blur();

        // # Change type to Select
        await sp.selectType(0, 'Select');

        // # Add options
        await sp.addOptions(0, ['Remote', 'Office', 'Hybrid']);

        await sp.saveAndWaitForSettled();

        // * Verify field was created with correct type via API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'Office Location');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('select');
        expect(createdField!.attrs.options).toBeDefined();
        expect(createdField!.attrs.options!.length).toBe(3);

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify editing an existing attribute name and saving persists
     * the rename to the server.
     *
     * @precondition
     * A custom profile attribute named "Old Name" exists via API setup.
     */
    test.fixme('edits an existing attribute name and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Old Name', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Find the attribute name input and edit it
        const nameInput = sp.nameInput(0);
        await expect(nameInput).toHaveValue('Old Name');
        await nameInput.fill('New Name');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify field was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'New Name')).toBeDefined();

        await cleanupFields(adminClient, {...fieldsMap, ...updatedMap});
    });

    /**
     * @objective Verify deleting a saved attribute via the dot menu removes it
     * from the server after confirmation and save.
     *
     * @precondition
     * A custom profile attribute named "To Delete" exists via API setup.
     */
    test.fixme('deletes an attribute via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'To Delete', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify the attribute exists
        await expect(sp.nameInputByValue('To Delete')).toBeVisible();

        // # Open dot menu for the field
        await sp.openDotMenu(fieldId);

        // # Click "Delete attribute"
        await sp.deleteAttribute();

        // # Confirm deletion in modal
        await sp.confirmDeletion();

        await sp.saveAndWaitForSettled();

        // * Verify field was deleted via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'To Delete')).toBeUndefined();

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify duplicating an attribute via the dot menu creates a copy
     * with "(copy)" suffix that persists after save.
     *
     * @precondition
     * A custom profile attribute named "Original" exists via API setup.
     */
    test.fixme('duplicates an attribute via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Original', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu for the field
        await sp.openDotMenu(fieldId);

        // # Click "Duplicate attribute"
        await sp.duplicateAttribute();

        // * Verify a copy row appeared with "(copy)" in the name
        await expect(sp.nameInputByValue('Original (copy)')).toBeVisible();

        await sp.saveAndWaitForSettled();

        // * Verify both fields exist via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'Original')).toBeDefined();
        expect(Object.values(updatedMap).find((f) => f.name === 'Original (copy)')).toBeDefined();

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify changing attribute visibility to "Always hide" via the
     * dot menu persists the hidden state to the server.
     *
     * @precondition
     * A custom profile attribute named "Visibility Test" exists via API setup.
     */
    test.fixme('changes attribute visibility via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Visibility Test', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu
        await sp.openDotMenu(fieldId);

        // # Select "Always hide" visibility
        await sp.setVisibility('Always hide');

        await sp.saveAndWaitForSettled();

        // * Verify visibility was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'Visibility Test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.visibility).toBe('hidden');

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify toggling "Editable by users" off via the dot menu sets
     * the attribute to admin-managed on the server.
     *
     * @precondition
     * A custom profile attribute named "Editable Test" exists via API setup.
     */
    test.fixme('toggles editable by users off via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Editable Test', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu
        await sp.openDotMenu(fieldId);

        // # Click "Editable by users" toggle
        await sp.toggleEditableByUsers();

        // # Close the dot menu — it stays open after toggling; backdrop would block Save click
        await sp.dismissMenu();

        await sp.saveAndWaitForSettled();

        // * Verify managed was set to 'admin' (not editable by users) via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'Editable Test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.managed).toBe('admin');

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify that leaving an attribute name empty shows a validation
     * warning and disables the Save button.
     */
    test('shows validation warning for empty attribute name', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Add a new attribute
        await sp.addAttribute();

        // # Clear the auto-focused name input (leave it empty)
        const nameInput = sp.nameInput(0);
        await nameInput.clear();
        await nameInput.blur();

        // * Verify validation warning about empty name is shown
        await expect(sp.validationMessage('Please enter an attribute name.')).toBeVisible();

        // * Verify Save button is disabled due to validation error
        await expect(sp.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify that entering a duplicate attribute name shows a "must be
     * unique" warning and disables the Save button.
     *
     * @precondition
     * A custom profile attribute named "Unique Name" exists via API setup.
     */
    test.fixme('shows validation warning for duplicate attribute names', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Unique Name', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Add a new attribute with the same name
        await sp.addAttribute();

        const newNameInput = sp.nameInput(1);
        await newNameInput.clear();
        await newNameInput.fill('Unique Name');
        await newNameInput.blur();

        // * Verify validation warning about duplicate name is shown
        await expect(sp.validationMessage('Attribute names must be unique.').first()).toBeVisible();

        // * Verify Save button is disabled
        await expect(sp.saveButton).toBeDisabled();

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify changing an attribute type from Text to Phone via the type
     * selector saves the updated value_type to the server.
     *
     * @precondition
     * A text attribute named "Contact Number" exists via API setup.
     */
    test.fixme('changes attribute type from text to phone', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create a text attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Contact Number', type: 'text'}];
        await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Select "Phone" type
        await sp.selectType(0, 'Phone');

        await sp.saveAndWaitForSettled();

        // * Verify field type was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'Contact Number');
        expect(updatedField).toBeDefined();
        expect(updatedField!.type).toBe('text');
        expect(updatedField!.attrs.value_type).toBe('phone');

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify creating a multiselect attribute with options saves
     * the field and its options to the server.
     */
    test('creates a multiselect attribute with options and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Click "Add attribute"
        await sp.addAttribute();

        // # Type attribute name
        const nameInput = sp.nameInput(0);
        await nameInput.fill('Skills');
        await nameInput.blur();

        // # Change type to Multi-select
        await sp.selectType(0, 'Multi-select');

        // # Add options
        await sp.addOptions(0, ['JavaScript', 'Python', 'Go']);

        await sp.saveAndWaitForSettled();

        // * Verify field was created with correct type via API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'Skills');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('multiselect');
        expect(createdField!.attrs.options).toBeDefined();
        expect(createdField!.attrs.options!.length).toBe(3);

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify creating multiple text attributes in a single session
     * and saving them all at once persists both to the server.
     */
    test.fixme('creates multiple text attributes and saves all at once', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Create first attribute (text)
        await sp.addAttribute();
        const firstInput = sp.nameInput(0);
        await firstInput.fill('Job Title');
        await firstInput.blur();

        // # Create second attribute (text)
        await sp.addAttribute();
        const secondInput = sp.nameInput(1);
        await secondInput.fill('Team Name');
        await secondInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify both fields were created via API
        const fieldsMap = await getFieldsMap(adminClient);
        expect(Object.values(fieldsMap).find((f) => f.name === 'Job Title')).toBeDefined();
        expect(Object.values(fieldsMap).find((f) => f.name === 'Team Name')).toBeDefined();

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify that renaming an attribute and saving persists the change
     * after a full page reload.
     *
     * @precondition
     * A custom profile attribute named "Persistent Field" exists via API setup.
     */
    test.fixme('persists attribute changes after page reload', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        await setupCustomProfileAttributeFields(adminClient, [{name: 'Persistent Field', type: 'text'}]);

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify attribute exists
        await expect(sp.nameInputByValue('Persistent Field')).toBeVisible();

        // # Edit the name
        const nameInput = sp.nameInput(0);
        await expect(nameInput).toHaveValue('Persistent Field');
        await nameInput.fill('Updated Persistent');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // # Reload the page
        await sp.goto();

        // * Verify the updated name persisted
        await expect(sp.nameInputByValue('Updated Persistent')).toBeVisible();

        await cleanupFields(adminClient, await getFieldsMap(adminClient));
    });

    /**
     * @objective Verify that deleting a newly added (unsaved) attribute removes
     * the row without a confirmation modal.
     */
    test(
        'deletes a newly added unsaved attribute without confirmation modal',
        {tag: '@user_attributes'},
        async ({pw}) => {
            const {systemConsolePage} = await setupTest(pw);
            const sp = systemConsolePage.systemProperties;

            // # Navigate to User Attributes page
            await sp.goto();

            // # Add a new attribute
            await sp.addAttribute();

            // # Type a name
            const nameInput = sp.nameInput(0);
            await nameInput.fill('Temporary');
            await nameInput.blur();

            // # Open dot menu for the new (pending) field
            await sp.openDotMenuForUnsaved();

            await sp.deleteAttribute();

            // * Verify the row is removed (no confirmation modal for unsaved fields)
            await expect(sp.nameInputByValue('Temporary')).not.toBeVisible();

            // * Verify Save button returns to disabled state (no net changes)
            await expect(sp.saveButton).toBeDisabled({timeout: 10000});
        },
    );
});
