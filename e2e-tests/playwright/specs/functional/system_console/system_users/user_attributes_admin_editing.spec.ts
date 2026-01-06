// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * LOCALIZATION NOTE:
 * This test suite uses test attributes (data-testid, id) for buttons to avoid
 * language dependencies, but still has some localization dependencies:
 * - Error message text assertions (e.g., 'Invalid email address')
 * - Field labels (e.g., 'Username', 'Email')
 * - Test data values (e.g., 'JavaScript', 'Python' option names)
 *
 * Currently runs in English-only (locale: 'en-US' in playwright.config.ts).
 * For multi-language support, these assertions would need refactoring.
 */

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
    deleteCustomProfileAttributes,
} from '../../channels/custom_profile_attributes/helpers';

// Test data for different user attribute types (non-synced only)
const testUserAttributes: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: 'Engineering',
        type: 'text',
        attrs: {
            visibility: 'when_set', // Ensure it's not synced
        },
    },
    {
        name: 'Work Email',
        value: 'work@company.com',
        type: 'text',
        attrs: {
            value_type: 'email',
            visibility: 'when_set', // Ensure it's not synced
        },
    },
    {
        name: 'Personal Website',
        value: 'https://johndoe.com',
        type: 'text',
        attrs: {
            value_type: 'url',
            visibility: 'when_set', // Ensure it's not synced
        },
    },
    {
        name: 'Location',
        type: 'select',
        attrs: {
            visibility: 'when_set', // Ensure it's not synced
        },
        options: [
            {name: 'Remote', color: '#00FFFF'},
            {name: 'Office', color: '#FF00FF'},
            {name: 'Hybrid', color: '#FFFF00'},
        ],
    },
    {
        name: 'Skills',
        type: 'multiselect',
        attrs: {
            visibility: 'when_set', // Ensure it's not synced
        },
        options: [
            {name: 'JavaScript', color: '#F0DB4F'},
            {name: 'React', color: '#61DAFB'},
            {name: 'Python', color: '#3776AB'},
            {name: 'Go', color: '#00ADD8'},
        ],
    },
];

let team: Team;
let adminUser: UserProfile;
let testUser: UserProfile;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;
let systemConsolePage: any;

test.describe('System Console - Admin User Profile Editing', () => {
    test.beforeEach(async ({pw}) => {
        // Ensure license for Custom Profile Attributes functionality
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        // Initialize with admin client
        ({team, adminUser, adminClient} = await pw.initSetup());

        // Create test user to edit
        testUser = await pw.createNewUserProfile(adminClient, 'admin-edit-target-');
        await adminClient.addToTeam(team.id, testUser.id);

        // Set up custom user attribute fields
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, testUserAttributes);

        // Set initial custom attribute values for the test user
        await setupCustomProfileAttributeValuesForUser(
            adminClient,
            testUserAttributes,
            attributeFieldsMap,
            testUser.id,
        );

        // Login as admin
        ({systemConsolePage} = await pw.testBrowser.login(adminUser));

        // Navigate to system console users
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Users');
        await systemConsolePage.systemUsers.toBeVisible();

        // Search for target user and navigate to user detail page
        await systemConsolePage.systemUsers.enterSearchText(testUser.email);
        const userRow = await systemConsolePage.systemUsers.getNthRow(1);
        await userRow.getByText(testUser.email).click();

        // Wait for user detail page to load
        await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);
    });

    test.afterEach(async ({pw}) => {
        // Clean up custom user attribute fields
        const {adminClient: cleanupClient} = await pw.getAdminClient();
        await deleteCustomProfileAttributes(cleanupClient, attributeFieldsMap);
    });

    test('MM-65126 Should edit custom user attributes from system console', async () => {
        // # Find and edit Department field (custom text attribute) - look for input near Department label
        const departmentLabel = systemConsolePage.page.locator('label').filter({hasText: /Department/});
        const departmentInput = departmentLabel.locator('input').first();
        await departmentInput.clear();
        await departmentInput.fill('Marketing');

        // # Click Save button (using test ID instead of text)
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // * Verify success (no error message and field retains new value)
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).not.toBeVisible();
        await expect(departmentInput).toHaveValue('Marketing');

        // * Verify Save button becomes disabled after successful save
        await expect(saveButton).toBeDisabled();
    });

    test('Should display user attributes in two-column layout', async () => {
        // * Verify two-column layout exists
        const twoColumnLayout = systemConsolePage.page.locator('.two-column-layout');
        await expect(twoColumnLayout).toBeVisible();

        // * Verify system fields are present (be more specific to avoid multiple matches)
        await expect(systemConsolePage.page.locator('label').filter({hasText: /^Username/})).toBeVisible();
        await expect(systemConsolePage.page.locator('label').filter({hasText: /^Authentication Method/})).toBeVisible();
        // Email field - check for system email (avoid Work Email by being more specific)
        const systemEmailExists = (await systemConsolePage.page.locator('input[type="email"]').count()) > 0;
        expect(systemEmailExists).toBe(true);

        // * Verify custom user attributes are present
        for (const field of testUserAttributes) {
            await expect(
                systemConsolePage.page.locator('label').filter({hasText: new RegExp(field.name)}),
            ).toBeVisible();
        }

        // * Verify we have input fields (at least 4-5 total)
        const inputElements = systemConsolePage.page.locator('input, select');
        const inputCount = await inputElements.count();
        expect(inputCount).toBeGreaterThan(4);

        // * Verify fields are arranged in rows with two columns
        const fieldRows = systemConsolePage.page.locator('.field-row');
        const rowCount = await fieldRows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test('Should edit system email attribute and save', async () => {
        // # Find system email field
        const systemEmailInput = systemConsolePage.page.locator('input[type="email"]').first();

        // # Enter new valid email
        const newEmail = `updated-${testUser.email}`;
        await systemEmailInput.clear();
        await systemEmailInput.fill(newEmail);

        // # Click Save button
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // * Verify success
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).not.toBeVisible();
        await expect(systemEmailInput).toHaveValue(newEmail);
        await expect(saveButton).toBeDisabled();
    });

    test('Should edit custom select attribute and save', async () => {
        // # Find Location select field near its label
        const locationLabel = systemConsolePage.page.locator('label').filter({hasText: /Location/});
        const locationSelect = locationLabel.locator('select').first();

        // # Get the first available option (since we can't predict the option value/ID)
        const firstOption = await locationSelect.locator('option').nth(1); // Skip the default "Select an option"
        const firstOptionValue = await firstOption.getAttribute('value');
        await locationSelect.selectOption(firstOptionValue || '');

        // # Click Save button
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // * Verify success and persistence
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).not.toBeVisible();
        // Don't check exact value since it's a generated ID, just verify it's not empty
        const selectedValue = await locationSelect.inputValue();
        expect(selectedValue).toBeTruthy();
        await expect(saveButton).toBeDisabled();
    });

    test('Should display custom multiselect attribute and save form', async () => {
        // * Verify Skills multiselect component is displayed
        const skillsLabel = systemConsolePage.page.locator('label').filter({hasText: /Skills/});
        await expect(skillsLabel).toBeVisible();

        // * Verify the multiselect control is present (React Select component)
        // Look for common React Select patterns
        const hasMultiselectElement =
            (await skillsLabel.locator('div, [class*="select"], [class*="Select"]').count()) > 0;
        expect(hasMultiselectElement).toBe(true);

        // # Make a change to a different field to trigger save state
        const departmentLabel = systemConsolePage.page.locator('label').filter({hasText: /Department/});
        const departmentInput = departmentLabel.locator('input').first();
        await departmentInput.fill('Engineering Updated');

        // # Verify save button becomes enabled
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();

        // # Save the form
        await saveButton.click();

        // * Verify success (no error message)
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).not.toBeVisible();

        // * Verify save completed
        await expect(saveButton).toBeDisabled();

        // * Verify the change persisted
        await expect(departmentInput).toHaveValue('Engineering Updated');
    });

    test('Should validate invalid email and show error with cancel option', async () => {
        // # Find system email field
        const systemEmailInput = systemConsolePage.page.locator('input[type="email"]').first();
        const originalEmail = await systemEmailInput.inputValue();

        // # Enter invalid email
        await systemEmailInput.clear();
        await systemEmailInput.fill('not-an-email');

        // # Click Save button
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // * Verify error message appears
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Invalid email address');

        // * Verify Cancel button is visible and enabled
        const cancelButton = systemConsolePage.page.locator('button:has-text("Cancel")');
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toBeEnabled();

        // * Verify Save button remains enabled (user can fix and retry)
        await expect(saveButton).toBeEnabled();

        // # Test the cancel functionality
        await cancelButton.click();

        // * Verify email reverts to original value
        await expect(systemEmailInput).toHaveValue(originalEmail);

        // * Verify error message disappears
        await expect(errorMessage).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(cancelButton).not.toBeVisible();

        // * Verify Save button becomes disabled
        await expect(saveButton).toBeDisabled();
    });

    test('Should validate invalid URL and show error with cancel option', async () => {
        // # Find custom URL field (Personal Website)
        const urlInput = systemConsolePage.page.locator('input[type="url"]').first();
        const originalUrl = await urlInput.inputValue();

        // # Enter invalid URL (specifically the one mentioned: "<%>")
        await urlInput.clear();
        await urlInput.fill('<%>');

        // # Click Save button
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // * Verify error message appears
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Invalid URL');

        // * Verify Cancel button is visible
        const cancelButton = systemConsolePage.page.locator('button:has-text("Cancel")');
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toBeEnabled();

        // # Test cancel functionality
        await cancelButton.click();

        // * Verify URL reverts to original value
        await expect(urlInput).toHaveValue(originalUrl);

        // * Verify error message disappears
        await expect(errorMessage).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(cancelButton).not.toBeVisible();
    });

    test('Should validate invalid email in custom email attribute', async () => {
        // # Find custom email field (Work Email) by its label
        const workEmailLabel = systemConsolePage.page.locator('label').filter({hasText: /Work Email/});
        const workEmailInput = workEmailLabel.locator('input[type="email"]').first();

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email-either');

        // # Click Save button
        const saveButton = systemConsolePage.page.locator('button:has-text("Save")');
        await saveButton.click();

        // * Verify error message appears
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Invalid email address');

        // * Verify Cancel button is available
        const cancelButton = systemConsolePage.page.locator('button:has-text("Cancel")');
        await expect(cancelButton).toBeVisible();
    });

    test('Should show save/cancel buttons when changes are made', async () => {
        // * Initially, Save should be disabled and Cancel should not be visible
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        const cancelButton = systemConsolePage.page.locator('button:has-text("Cancel")');
        await expect(saveButton).toBeDisabled();
        await expect(cancelButton).not.toBeVisible();

        // # Make a change to trigger save needed state - find Department field by label
        const departmentLabel = systemConsolePage.page.locator('label').filter({hasText: /Department/});
        const departmentInput = departmentLabel.locator('input').first();
        const originalValue = await departmentInput.inputValue();
        await departmentInput.clear();
        await departmentInput.fill('Changed Value');

        // * Verify Save button becomes enabled and Cancel button appears
        await expect(saveButton).toBeEnabled();
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toBeEnabled();

        // # Click Cancel
        await cancelButton.click();

        // * Verify changes are reverted
        await expect(departmentInput).toHaveValue(originalValue);

        // * Verify Cancel button disappears
        await expect(cancelButton).not.toBeVisible();

        // * Verify Save button is disabled
        await expect(saveButton).toBeDisabled();
    });

    test('Should save all user attribute changes atomically', async () => {
        // # Make changes to both system and custom attributes
        const systemEmailInput = systemConsolePage.page.locator('input[type="email"]').first();
        const newEmail = `atomic-test-${testUser.email}`;
        await systemEmailInput.clear();
        await systemEmailInput.fill(newEmail);

        const departmentLabel = systemConsolePage.page.locator('label').filter({hasText: /Department/});
        const departmentInput = departmentLabel.locator('input').first();
        await departmentInput.clear();
        await departmentInput.fill('Sales');

        // # Click Save button
        const saveButton = systemConsolePage.page.locator('[data-testid="saveSetting"]');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // * Verify both changes were saved successfully
        const errorMessage = systemConsolePage.page.locator('.error-message');
        await expect(errorMessage).not.toBeVisible();
        await expect(systemEmailInput).toHaveValue(newEmail);
        await expect(departmentInput).toHaveValue('Sales');
        await expect(saveButton).toBeDisabled();
    });
});
