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
 * IMPORTANT: All field names must be valid CEL identifiers — matching
 * ^[A-Za-z_][A-Za-z0-9_]*$ — because the server validates them against that
 * pattern and returns HTTP 422 for any name containing spaces or special chars.
 * Use underscores instead of spaces (e.g. 'Test_Department' not 'Test Department').
 */

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended, SystemConsolePage} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../channels/custom_profile_attributes/helpers';
import {
    setupCustomProfileAttributeFields,
    deleteCustomProfileAttributes,
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
    test.afterAll(async () => {
        try {
            const {adminClient} = await getAdminClient({skipLog: true});
            const fields = (await adminClient.getCustomProfileAttributeFields()) as Array<{name: string}>;
            if (!fields.some((f) => f.name === 'Department')) {
                await adminClient.createCustomProfileAttributeField({
                    name: 'Department',
                    type: 'text',
                    attrs: {sort_order: 0},
                } as any);
            }
        } catch {
            // Best-effort cleanup; if the server is unlicensed or fields API
            // is unavailable, ABAC tests will handle their own attribute setup.
        }
    });

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

        // * Verify a new row with an input appears in the table.
        // Use lastNameInput() — not positional nameInput(0) — so concurrent tests
        // inserting UAAE/ABAC rows don't shift the index to the wrong field.
        const nameInput = sp.lastNameInput();
        await expect(nameInput).toBeVisible();

        // # Type attribute name (must be a valid CEL identifier — no spaces)
        await nameInput.fill('test_department');
        await nameInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify the field was created by fetching from API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'test_department');
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

        // # Type attribute name (must be a valid CEL identifier — no spaces)
        const nameInput = sp.lastNameInput();
        await nameInput.fill('office_location');
        await nameInput.blur();

        // # Change type to Select (use selectLastType so the index stays correct
        // even when concurrent tests have inserted extra rows)
        await sp.selectLastType('Select');

        // # Add options
        await sp.addOptionsToLast(['Remote', 'Office', 'Hybrid']);

        // # Click the name input to blur the react-select and commit all pending option state
        await sp.lastNameInput().click();

        await sp.saveAndWaitForSettled();

        // * Verify field was created with correct type via API
        const fieldsMap = await getFieldsMap(adminClient);
        const createdField = Object.values(fieldsMap).find((f) => f.name === 'office_location');
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
     * A custom profile attribute named "Old_Name" exists via API setup.
     */
    test.fixme('edits an existing attribute name and saves', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'old_name', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        const nameInput = sp.nameInputByValue('old_name');
        await expect(nameInput).toBeVisible();
        await nameInput.focus();
        await nameInput.fill('new_name');
        // blur via keyboard — the CSS-attribute locator no longer matches
        // after fill() so calling .blur() on it would time out.
        await sp.page.keyboard.press('Tab');

        await sp.saveAndWaitForSettled();

        // * Verify field was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'new_name')).toBeDefined();

        await cleanupFields(adminClient, {...fieldsMap, ...updatedMap});
    });

    /**
     * @objective Verify deleting a saved attribute via the dot menu removes it
     * from the server after confirmation and save.
     *
     * @precondition
     * A custom profile attribute named "To_Delete" exists via API setup.
     */
    test.fixme('deletes an attribute via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'to_delete', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify the attribute exists
        await expect(sp.nameInputByValue('to_delete')).toBeVisible();

        // # Open dot menu for the field
        await sp.openDotMenu(fieldId);

        // # Click "Delete attribute"
        await sp.deleteAttribute();

        // # Confirm deletion in modal
        await sp.confirmDeletion();

        await sp.saveAndWaitForSettled();

        // * Verify field was deleted via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'to_delete')).toBeUndefined();

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify duplicating an attribute via the dot menu creates a copy
     * with a valid name that persists after save.
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

        // * Verify a copy row appeared with "_copy" suffix in the name
        await expect(sp.nameInputByValue('Original_copy')).toBeVisible();

        // # Rename the copy to a valid CEL identifier (server rejects spaces/parens with 422)
        const copyInput = sp.lastNameInput();
        await copyInput.fill('Original_copy');
        await copyInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify both fields exist via API
        const updatedMap = await getFieldsMap(adminClient);
        expect(Object.values(updatedMap).find((f) => f.name === 'Original')).toBeDefined();
        expect(Object.values(updatedMap).find((f) => f.name === 'Original_copy')).toBeDefined();

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify changing attribute visibility to "Always hide" via the
     * dot menu persists the hidden state to the server.
     *
     * @precondition
     * A custom profile attribute named "Visibility_Test" exists via API setup.
     */
    test.fixme('changes attribute visibility via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'visibility_test', type: 'text'}];
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
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'visibility_test');
        expect(updatedField).toBeDefined();
        expect(updatedField!.attrs.visibility).toBe('hidden');

        await cleanupFields(adminClient, updatedMap);
    });

    /**
     * @objective Verify toggling "Editable by users" off via the dot menu sets
     * the attribute to admin-managed on the server.
     *
     * @precondition
     * A custom profile attribute named "Editable_Test" exists via API setup.
     */
    test.fixme('toggles editable by users off via dot menu', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'editable_test', type: 'text'}];
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);
        const fieldId = Object.keys(fieldsMap)[0];

        // # Navigate to User Attributes page
        await sp.goto();

        // # Open dot menu
        await sp.openDotMenu(fieldId);

        // # Click "Editable by users" toggle
        await sp.toggleEditableByUsers();

        // # Wait for the checkbox to reflect the toggled (unchecked) state before dismissing,
        // # to avoid a race where Escape fires before the UI registers the change
        await expect(systemConsolePage.page.getByRole('menuitemcheckbox', {name: 'Editable by users'})).toHaveAttribute(
            'aria-checked',
            'false',
        );

        // # Close the dot menu — it stays open after toggling; backdrop would block Save click
        await sp.dismissMenu();

        await sp.saveAndWaitForSettled();

        // * Verify managed was set to 'admin' (not editable by users) via API
        // # Use expect.poll to tolerate brief server-side propagation delay
        await expect
            .poll(async () => {
                const map = await getFieldsMap(adminClient);
                return Object.values(map).find((f) => f.name === 'editable_test');
            })
            .toMatchObject({attrs: {managed: 'admin'}});

        await cleanupFields(adminClient, await getFieldsMap(adminClient));
    });

    /**
     * @objective Verify that clearing the auto-derived CEL identifier (Name)
     * after entering a Display Name shows the empty-name validation warning
     * in both the offending Name cell (red icon) and a banner below the table,
     * and that Save remains disabled.
     */
    test('shows validation warning for empty attribute name', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Add a new attribute
        await sp.addAttribute();

        // # Fill Display Name so the Name field auto-derives as snake_case
        const displayNameInput = sp.lastDisplayNameInput();
        await displayNameInput.fill('Job Title');
        await displayNameInput.blur();

        // * Verify the Name field auto-populated with the snake_case identifier
        const nameInput = sp.lastNameInput();
        await expect(nameInput).toHaveValue('job_title');

        // # Clear the auto-derived identifier and blur to trigger the empty-name warning
        await nameInput.clear();
        await nameInput.blur();

        // * Verify the in-cell error icon is rendered for the offending row
        await expect(sp.identifierValidationError()).toBeVisible();

        // * Verify the bottom banner with the title and body copy is rendered
        await expect(sp.validationBannerByTitle('Please enter an attribute name.')).toBeVisible();
        await expect(sp.validationBannerByTitle(/missing a Name/)).toBeVisible();

        // * Verify Save button is disabled due to validation error
        await expect(sp.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify that two pending fields with the same Name surface the
     * `name_unique` validation: both rows display the in-cell error icon, a
     * single banner appears below the table, and Save stays disabled.
     */
    test('shows validation warning for duplicate attribute names', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        const dupName = `dup_${Date.now()}`;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Add the first new attribute with the duplicate name. We commit the
        // # value via lastNameInput() here, then resolve the row by value below
        // # so subsequent addAttribute() calls don't cause `.last()` to slide
        // # onto the second row.
        await sp.addAttribute();
        await sp.lastNameInput().fill(dupName);
        await sp.lastNameInput().blur();

        // # Add the second new attribute with the same name (triggers name_unique)
        await sp.addAttribute();
        const secondNameInput = sp.lastNameInput();
        await secondNameInput.fill(dupName);
        await secondNameInput.blur();

        // * Both rows should display the in-cell error icon
        await expect(sp.identifierValidationError()).toHaveCount(2);

        // * A single name_unique banner is rendered below the table
        await expect(sp.validationBannerByTitle('Attribute names must be unique.')).toHaveCount(1);
        await expect(sp.validationBannerByTitle(/share the same Name/)).toBeVisible();

        // * Verify Save button is disabled
        await expect(sp.saveButton).toBeDisabled();
    });

    /**
     * @objective Verify the `name_taken` validation path: renaming a persisted
     * field to free its name, then renaming a second persisted field to take
     * the freed name, surfaces the in-cell icon and bottom banner. This is the
     * only sequence that reaches the `NameTaken` branch — duplicate-pending
     * fields trigger `NameUnique` first.
     *
     * @precondition
     * Two custom profile attributes (`taken_a`, `taken_b`) exist via API setup.
     */
    test(
        'shows validation warning when a persisted attribute name is taken',
        {tag: '@user_attributes'},
        async ({pw}) => {
            const {adminClient, systemConsolePage} = await setupTest(pw);
            const sp = systemConsolePage.systemProperties;

            // # Create two persisted attributes via API
            const uid = Date.now();
            const nameA = `taken_a_${uid}`;
            const nameB = `taken_b_${uid}`;
            const freedName = `taken_freed_${uid}`;
            const attributes: CustomProfileAttribute[] = [
                {name: nameA, type: 'text'},
                {name: nameB, type: 'text'},
            ];
            const fieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

            try {
                // # Navigate to User Attributes page
                await sp.goto();

                // # Rename A first — frees the original `taken_a_*` name
                const inputA = sp.nameInputByValue(nameA);
                await expect(inputA).toBeVisible();
                await inputA.focus();
                await inputA.fill(freedName);
                await sp.page.keyboard.press('Tab');

                // # Rename B to the now-freed name — reaches the NameTaken branch
                const inputB = sp.nameInputByValue(nameB);
                await expect(inputB).toBeVisible();
                await inputB.focus();
                await inputB.fill(nameA);
                await sp.page.keyboard.press('Tab');

                // * Verify the offending row carries the in-cell error icon
                await expect(sp.identifierValidationError()).toHaveCount(1);

                // * Verify the bottom banner with the name_taken title and body
                await expect(sp.validationBannerByTitle('Attribute name already taken.')).toBeVisible();
                await expect(sp.validationBannerByTitle(/already used by another attribute/)).toBeVisible();

                // * Verify Save button is disabled
                await expect(sp.saveButton).toBeDisabled();
            } finally {
                await cleanupFields(adminClient, fieldsMap);
            }
        },
    );

    /**
     * @objective Verify changing an attribute type from Text to Phone via the type
     * selector saves the updated value_type to the server.
     *
     * @precondition
     * A text attribute named "Contact_Number" exists via API setup.
     */
    test.fixme('changes attribute type from text to phone', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create a text attribute via API
        const attributes: CustomProfileAttribute[] = [{name: 'contact_number', type: 'text'}];
        await setupCustomProfileAttributeFields(adminClient, attributes);

        // # Navigate to User Attributes page
        await sp.goto();

        // # Select "Phone" type for the Contact_Number field.
        // Use selectTypeForField() — resolves the row index by name so concurrent
        // UAAE/ABAC rows don't shift the positional index.
        await sp.selectTypeForField('contact_number', 'Phone');

        await sp.saveAndWaitForSettled();

        // * Verify field type was updated via API
        const updatedMap = await getFieldsMap(adminClient);
        const updatedField = Object.values(updatedMap).find((f) => f.name === 'contact_number');
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

        // # Type attribute name ('Skills' is a single-word valid CEL identifier)
        const nameInput = sp.lastNameInput();
        await nameInput.fill('Skills');
        await nameInput.blur();

        // # Change type to Multi-select
        await sp.selectLastType('Multi-select');

        // # Add options
        await sp.addOptionsToLast(['JavaScript', 'Python', 'Go']);

        // # Click the name input to blur the react-select and commit all pending option state
        await sp.lastNameInput().click();

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

        // # Create first attribute (text) — use lastNameInput() after each addAttribute()
        await sp.addAttribute();
        const firstInput = sp.lastNameInput();
        await firstInput.fill('job_title');
        await firstInput.blur();

        // # Create second attribute (text)
        await sp.addAttribute();
        const secondInput = sp.lastNameInput();
        await secondInput.fill('team_name');
        await secondInput.blur();

        await sp.saveAndWaitForSettled();

        // * Verify both fields were created via API
        const fieldsMap = await getFieldsMap(adminClient);
        expect(Object.values(fieldsMap).find((f) => f.name === 'job_title')).toBeDefined();
        expect(Object.values(fieldsMap).find((f) => f.name === 'team_name')).toBeDefined();

        await cleanupFields(adminClient, fieldsMap);
    });

    /**
     * @objective Verify that renaming an attribute and saving persists the change
     * after a full page reload.
     *
     * @precondition
     * A custom profile attribute named "Persistent_Field" exists via API setup.
     */
    test.fixme('persists attribute changes after page reload', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Create an attribute via API
        await setupCustomProfileAttributeFields(adminClient, [{name: 'persistent_field', type: 'text'}]);

        // # Navigate to User Attributes page
        await sp.goto();

        // * Verify attribute exists
        await expect(sp.nameInputByValue('persistent_field')).toBeVisible();

        // # Edit the name using a value-based locator so concurrent UAAE/ABAC rows
        // don't shift a positional index to the wrong field.
        const nameInput = sp.nameInputByValue('persistent_field');
        await expect(nameInput).toHaveValue('persistent_field');
        await nameInput.focus();
        await nameInput.fill('updated_persistent');
        // blur via keyboard — the value-based locator is stale after fill()
        await sp.page.keyboard.press('Tab');

        await sp.saveAndWaitForSettled();

        // # Reload the page
        await sp.goto();

        // * Verify the updated name persisted
        await expect(sp.nameInputByValue('updated_persistent')).toBeVisible();

        await cleanupFields(adminClient, await getFieldsMap(adminClient));
    });

    /**
     * @objective Verify that two distinct name validation errors produce two
     * stacked banners below the table (one per type), both offending rows
     * carry the in-cell error icon, and that fixing one row removes only the
     * matching banner while the other persists.
     */
    test('stacks one banner per distinct validation error type', {tag: '@user_attributes'}, async ({pw}) => {
        const {systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        // # Navigate to User Attributes page
        await sp.goto();

        // # Row 1: trigger name_required (fill Display Name, clear auto-Name, blur)
        await sp.addAttribute();
        const firstDisplayName = sp.lastDisplayNameInput();
        await firstDisplayName.fill('Job Title');
        await firstDisplayName.blur();
        const firstNameInput = sp.lastNameInput();
        await expect(firstNameInput).toHaveValue('job_title');
        await firstNameInput.clear();
        await firstNameInput.blur();

        // # Row 2: trigger name_invalid_cel (reserved CEL keyword)
        await sp.addAttribute();
        const secondNameInput = sp.lastNameInput();
        await secondNameInput.fill('true');
        await secondNameInput.blur();

        // * Both banners stack at the bottom of the table
        await expect(sp.validationBannerByTitle('Please enter an attribute name.')).toBeVisible();
        await expect(sp.validationBannerByTitle(/Identifier must start with a letter or underscore/)).toBeVisible();

        // * Both offending Name cells carry the in-cell error icon
        await expect(sp.identifierValidationError()).toHaveCount(2);

        // * Save button stays disabled while any banner is present
        await expect(sp.saveButton).toBeDisabled();

        // # Fix the second row (give it a valid name) — only the CEL banner should disappear
        await secondNameInput.fill('valid_name');
        await secondNameInput.blur();

        await expect(sp.validationBannerByTitle(/Identifier must start with a letter or underscore/)).toHaveCount(0);
        await expect(sp.validationBannerByTitle('Please enter an attribute name.')).toBeVisible();
        await expect(sp.identifierValidationError()).toHaveCount(1);
        await expect(sp.saveButton).toBeDisabled();
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

            // # Type a name — 'Temporary' is a valid single-word CEL identifier.
            // Use lastNameInput() so concurrent UAAE/ABAC rows don't shift the index.
            const nameInput = sp.lastNameInput();
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
