// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for System Console > User Attributes page.
 *
 * Tests the admin UI for managing Custom Profile Attribute (CPA) field definitions,
 * including creating, editing, deleting, and configuring attribute fields.
 *
 * Related: MM-62558 / PR #30722 (Profile Popup CPA tests pattern reference)
 *
 * LOCATOR NOTE:
 * Playwright locators are lazy and re-evaluate on every action. A value-based
 * selector like input[value="Foo"] becomes stale after fill() changes the value,
 * causing subsequent calls (blur, click, etc.) to time out. Use a stable locator
 * (data-testid + nth) for any input you plan to mutate; value-based selectors are
 * fine for read-only assertions (toBeVisible, toHaveValue, etc.).
 *
 * LOCALIZATION NOTE:
 * This test suite uses test attributes (data-testid, id, aria-label) where possible.
 * Some assertions depend on English text (field type labels, validation messages, button text).
 * Currently runs in English-only (locale: 'en-US' in playwright.config.ts).
 */

import {UserProfile} from '@mattermost/types/users';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test, SystemConsolePage} from '@mattermost/playwright-lib';

import {
    setupCustomProfileAttributeFields,
    deleteCustomProfileAttributes,
    CustomProfileAttribute,
} from '../../channels/custom_profile_attributes/helpers';

const USER_ATTRIBUTES_URL = '/admin_console/system_attributes/user_attributes';

let adminUser: UserProfile;
let adminClient: Client4;
let systemConsolePage: SystemConsolePage;
let attributeFieldsMap: Record<string, UserPropertyField>;

async function refreshFieldsMap(client: Client4): Promise<void> {
    const fields: UserPropertyField[] = await client.getCustomProfileAttributeFields();
    attributeFieldsMap = {};
    for (const field of fields) {
        attributeFieldsMap[field.id] = field;
    }
}

test.describe('System Console - User Attributes Management', () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        ({adminUser, adminClient} = await pw.initSetup());

        // Clean up any pre-existing CPA fields to start with a blank slate
        try {
            const existing = await adminClient.getCustomProfileAttributeFields();
            if (existing?.length) {
                const existingMap: Record<string, UserPropertyField> = {};
                for (const f of existing) {
                    existingMap[f.id] = f;
                }
                await deleteCustomProfileAttributes(adminClient, existingMap);
            }
        } catch {
            // No fields to clean up
        }

        attributeFieldsMap = {};

        ({systemConsolePage} = await pw.testBrowser.login(adminUser));
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
    });

    test.afterEach(async ({pw}) => {
        if (attributeFieldsMap && Object.keys(attributeFieldsMap).length > 0) {
            const {adminClient: cleanupClient} = await pw.getAdminClient();
            await deleteCustomProfileAttributes(cleanupClient, attributeFieldsMap);
        }
    });

    test('Should navigate to User Attributes page and display empty state', async () => {
        // # Navigate to User Attributes via sidebar
        await systemConsolePage.sidebar.systemAttributes.userAttributes.click();

        // * Verify the URL and page loaded
        await systemConsolePage.page.waitForURL(`**${USER_ATTRIBUTES_URL}`);
        const pageContainer = systemConsolePage.page.getByTestId('systemProperties');
        await expect(pageContainer).toBeVisible();

        // * Verify the "Add attribute" link button is visible
        const addButton = systemConsolePage.page.getByRole('button', {name: 'Add attribute'});
        await expect(addButton).toBeVisible();

        // * Verify Save button is present but disabled (no changes)
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeDisabled();
    });

    test('Should display pre-existing attributes in the table', async () => {
        // # Set up attributes via API
        const attributes: CustomProfileAttribute[] = [
            {name: 'Department', type: 'text'},
            {name: 'Role', type: 'text', attrs: {value_type: 'url'}},
        ];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify attributes appear in the table
        const deptInput = systemConsolePage.page.getByTestId('property-field-input').filter({hasText: 'Department'});
        await expect(deptInput.or(systemConsolePage.page.locator('input[value="Department"]'))).toBeVisible();

        const roleInput = systemConsolePage.page.locator('input[value="Role"]');
        await expect(roleInput).toBeVisible();
    });

    test('Should create a new text attribute and save', async () => {
        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Click "Add attribute"
        const addButton = systemConsolePage.page.getByRole('button', {name: 'Add attribute'});
        await addButton.click();

        // * Verify a new row with an input appears in the table
        const nameInputs = systemConsolePage.page.locator('input[data-testid="property-field-input"]');
        await expect(nameInputs.first()).toBeVisible();

        // # Type attribute name
        await nameInputs.first().fill('Test Department');
        await nameInputs.first().blur();

        // * Verify Save button is now enabled
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();

        // # Save changes
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify Save button returns to disabled after successful save
        await expect(saveButton).toBeDisabled({timeout: 10000});

        // * Verify the field was created by fetching from API
        await refreshFieldsMap(adminClient);
        const createdField = Object.values(attributeFieldsMap).find((f) => f.name === 'Test Department');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('text');
    });

    test('Should create a select attribute with options and save', async () => {
        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Click "Add attribute"
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();

        // # Type attribute name
        const nameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').first();
        await nameInput.fill('Office Location');
        await nameInput.blur();

        // # Change type to Select via type selector menu
        const typeButton = systemConsolePage.page.getByTestId('fieldTypeSelectorMenuButton').first();
        await typeButton.click();

        const selectOption = systemConsolePage.page.locator('#select');
        await selectOption.click();

        // # Add options to the select field via the CreatableSelect input
        const valuesInput = systemConsolePage.page.locator('input[id^="react-select-"]').first();
        await valuesInput.fill('Remote');
        await valuesInput.press('Enter');
        await valuesInput.fill('Office');
        await valuesInput.press('Enter');
        await valuesInput.fill('Hybrid');
        await valuesInput.press('Enter');

        // # Save changes
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify field was created with correct type via API
        await refreshFieldsMap(adminClient);
        const createdField = Object.values(attributeFieldsMap).find((f) => f.name === 'Office Location');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('select');
        expect(createdField!.attrs.options).toBeDefined();
        expect(createdField!.attrs.options!.length).toBe(3);
    });

    test('Should edit an existing attribute name and save', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Old Name', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Find the attribute name input and edit it (see LOCATOR NOTE at top of file)
        const nameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').first();
        await expect(nameInput).toHaveValue('Old Name');
        await nameInput.fill('New Name');
        await nameInput.blur();

        // * Verify Save button is enabled
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();

        // # Save changes
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify field was updated via API
        await refreshFieldsMap(adminClient);
        const updatedField = Object.values(attributeFieldsMap).find((f) => f.name === 'New Name');
        expect(updatedField).toBeDefined();
    });

    test('Should delete an attribute via dot menu', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'To Delete', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(attributeFieldsMap)[0];

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the attribute exists
        await expect(systemConsolePage.page.locator('input[value="To Delete"]')).toBeVisible();

        // # Open dot menu for the field
        const dotMenuButton = systemConsolePage.page.getByTestId(`user-property-field_dotmenu-${fieldId}`);
        await dotMenuButton.click();

        // # Click "Delete attribute"
        const deleteMenuItem = systemConsolePage.page.locator('#user-property-field_dotmenu_delete');
        await deleteMenuItem.click();

        // # Confirm deletion in modal
        const confirmButton = systemConsolePage.page.getByRole('button', {name: 'Delete'});
        await confirmButton.click();

        // * Verify Save button is enabled
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();

        // # Save changes
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify field was deleted via API
        await refreshFieldsMap(adminClient);
        const deletedField = Object.values(attributeFieldsMap).find((f) => f.name === 'To Delete');
        expect(deletedField).toBeUndefined();
    });

    test('Should duplicate an attribute via dot menu', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Original', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(attributeFieldsMap)[0];

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Open dot menu for the field
        const dotMenuButton = systemConsolePage.page.getByTestId(`user-property-field_dotmenu-${fieldId}`);
        await dotMenuButton.click();

        // # Click "Duplicate attribute"
        const duplicateMenuItem = systemConsolePage.page.locator('#user-property-field_dotmenu_duplicate');
        await duplicateMenuItem.click();

        // * Verify a copy row appeared with "(copy)" in the name
        const copyInput = systemConsolePage.page.locator('input[value="Original (copy)"]');
        await expect(copyInput).toBeVisible();

        // * Verify Save button is enabled
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();

        // # Save changes
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify both fields exist via API
        await refreshFieldsMap(adminClient);
        expect(Object.values(attributeFieldsMap).find((f) => f.name === 'Original')).toBeDefined();
        expect(Object.values(attributeFieldsMap).find((f) => f.name === 'Original (copy)')).toBeDefined();
    });

    test('Should change attribute visibility via dot menu', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Visibility Test', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(attributeFieldsMap)[0];

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Open dot menu
        const dotMenuButton = systemConsolePage.page.getByTestId(`user-property-field_dotmenu-${fieldId}`);
        await dotMenuButton.click();

        // # Hover on Visibility submenu to open it
        const visibilitySubmenu = systemConsolePage.page.locator(`#user-property-field_dotmenu-${fieldId}-visibility`);
        await visibilitySubmenu.hover();

        // # Select "Always hide" — use force:true since submenu items may detach/reattach during open animation
        const alwaysHideOption = systemConsolePage.page.locator('#user-property-field_dotmenu_visibility-hidden');
        await expect(alwaysHideOption).toBeAttached();
        await alwaysHideOption.click({force: true});

        // # Save changes
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify visibility was updated via API
        await refreshFieldsMap(adminClient);
        const updatedField = Object.values(attributeFieldsMap).find((f) => f.name === 'Visibility Test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.visibility).toBe('hidden');
    });

    test('Should toggle editable by users via dot menu', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Editable Test', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(attributeFieldsMap)[0];

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Open dot menu
        const dotMenuButton = systemConsolePage.page.getByTestId(`user-property-field_dotmenu-${fieldId}`);
        await dotMenuButton.click();

        // # Click "Editable by users" toggle
        const editableItem = systemConsolePage.page.locator('#user-property-field_dotmenu_editable-by-users');
        await editableItem.click();

        // # Close the dot menu — it stays open after toggling; backdrop would block Save click
        await systemConsolePage.page.keyboard.press('Escape');

        // # Save changes
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify managed was set to 'admin' (not editable by users) via API
        await refreshFieldsMap(adminClient);
        const updatedField = Object.values(attributeFieldsMap).find((f) => f.name === 'Editable Test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.managed).toBe('admin');
    });

    test('Should show validation warning for empty attribute name', async () => {
        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Add a new attribute
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();

        // # Clear the auto-focused name input (leave it empty)
        const nameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').first();
        await nameInput.clear();
        await nameInput.blur();

        // * Verify validation warning about empty name is shown
        const warning = systemConsolePage.page.getByText('Please enter an attribute name.');
        await expect(warning).toBeVisible();

        // * Verify Save button is disabled due to validation error
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeDisabled();
    });

    test('Should show validation warning for duplicate attribute names', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Unique Name', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Add a new attribute with the same name
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();

        const newNameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').last();
        await newNameInput.clear();
        await newNameInput.fill('Unique Name');
        await newNameInput.blur();

        // * Verify validation warning about duplicate name is shown
        // Both fields exist in pending state simultaneously → "must be unique" (not "already taken")
        const warning = systemConsolePage.page.getByText('Attribute names must be unique.');
        await expect(warning.first()).toBeVisible();

        // * Verify Save button is disabled
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeDisabled();
    });

    test('Should change attribute type from Text to Phone', async () => {
        // # Create a text attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Contact Number', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Click the type selector for the field
        const typeButton = systemConsolePage.page.getByTestId('fieldTypeSelectorMenuButton').first();
        await typeButton.click();

        // # Select "Phone" type
        const phoneOption = systemConsolePage.page.locator('#phone');
        await phoneOption.click();

        // # Save changes
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify field type was updated via API
        await refreshFieldsMap(adminClient);
        const updatedField = Object.values(attributeFieldsMap).find((f) => f.name === 'Contact Number');
        expect(updatedField).toBeDefined();
        expect(updatedField!.type).toBe('text');
        expect(updatedField!.attrs.value_type).toBe('phone');
    });

    test('Should create a multiselect attribute with options and save', async () => {
        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Click "Add attribute"
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();

        // # Type attribute name
        const nameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').first();
        await nameInput.fill('Skills');
        await nameInput.blur();

        // # Change type to Multi-select
        const typeButton = systemConsolePage.page.getByTestId('fieldTypeSelectorMenuButton').first();
        await typeButton.click();

        const multiselectOption = systemConsolePage.page.locator('#multiselect');
        await multiselectOption.click();

        // # Add options via the CreatableSelect input
        const valuesInput = systemConsolePage.page.locator('input[id^="react-select-"]').first();
        await valuesInput.fill('JavaScript');
        await valuesInput.press('Enter');
        await valuesInput.fill('Python');
        await valuesInput.press('Enter');
        await valuesInput.fill('Go');
        await valuesInput.press('Enter');

        // # Save changes
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify field was created with correct type via API
        await refreshFieldsMap(adminClient);
        const createdField = Object.values(attributeFieldsMap).find((f) => f.name === 'Skills');
        expect(createdField).toBeDefined();
        expect(createdField!.type).toBe('multiselect');
        expect(createdField!.attrs.options).toBeDefined();
        expect(createdField!.attrs.options!.length).toBe(3);
    });

    test('Should create multiple attributes of different types and save all at once', async () => {
        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Create first attribute (text)
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();
        const firstInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').nth(0);
        await firstInput.fill('Job Title');
        await firstInput.blur();

        // # Create second attribute (text)
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();
        const secondInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').nth(1);
        await secondInput.fill('Team Name');
        await secondInput.blur();

        // # Save all changes at once
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify both fields were created via API
        await refreshFieldsMap(adminClient);
        expect(Object.values(attributeFieldsMap).find((f) => f.name === 'Job Title')).toBeDefined();
        expect(Object.values(attributeFieldsMap).find((f) => f.name === 'Team Name')).toBeDefined();
    });

    test('Should persist attribute changes after page reload', async () => {
        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'Persistent Field', type: 'text'}];
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify attribute exists
        await expect(systemConsolePage.page.locator('input[value="Persistent Field"]')).toBeVisible();

        // # Edit the name (see LOCATOR NOTE at top of file)
        const nameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').first();
        await expect(nameInput).toHaveValue('Persistent Field');
        await nameInput.fill('Updated Persistent');
        await nameInput.blur();

        // # Save
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Reload the page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify the updated name persisted
        await expect(systemConsolePage.page.locator('input[value="Updated Persistent"]')).toBeVisible();

        // Update cleanup map
        await refreshFieldsMap(adminClient);
    });

    test('Should delete a newly added (unsaved) attribute without confirmation modal', async () => {
        // # Navigate to User Attributes page
        await systemConsolePage.page.goto(USER_ATTRIBUTES_URL);
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Add a new attribute
        await systemConsolePage.page.getByRole('button', {name: 'Add attribute'}).click();

        // # Type a name
        const nameInput = systemConsolePage.page.locator('input[data-testid="property-field-input"]').first();
        await nameInput.fill('Temporary');
        await nameInput.blur();

        // # Open dot menu for the new (pending) field and click delete
        const dotMenuButtons = systemConsolePage.page.locator('.user-property-field-dotmenu-menu-button');
        await dotMenuButtons.last().click();

        const deleteMenuItem = systemConsolePage.page.locator('#user-property-field_dotmenu_delete');
        await deleteMenuItem.click();

        // * Verify the row is removed (no confirmation modal for unsaved fields)
        await expect(systemConsolePage.page.locator('input[value="Temporary"]')).not.toBeVisible();

        // * Verify Save button returns to disabled state (no net changes).
        //   BUG: the app does not reset dirty state after removing an unsaved row,
        //   so Save stays enabled. test.fail() lets CI pass while the bug exists
        //   and will alert us when the fix lands (the test will unexpectedly pass).
        test.fail();
        const saveButton = systemConsolePage.page.getByTestId('saveSetting');
        await expect(saveButton).toBeDisabled({timeout: 10000});
    });
});
