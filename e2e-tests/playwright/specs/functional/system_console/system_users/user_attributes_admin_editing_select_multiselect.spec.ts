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

import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test, SystemConsolePage} from '@mattermost/playwright-lib';

import {cleanupAdminEditingTest, setupAdminEditingTest} from './support';

let attributeFieldsMap: Record<string, UserPropertyField>;
let systemConsolePage: SystemConsolePage;

test.describe('System Console - Admin User Profile Editing', () => {
    test.beforeEach(async ({pw}) => {
        ({systemConsolePage, attributeFieldsMap} = await setupAdminEditingTest(pw));
    });

    test.afterEach(async ({pw}) => {
        await cleanupAdminEditingTest(pw, attributeFieldsMap);
    });

    test('Should edit custom select attribute and save', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find Location select field
        const locationSelect = userCard.getSelectByExactLabel('Location');

        // # Get the first available option (since we can't predict the option value/ID)
        const firstOption = await locationSelect.locator('option').nth(1); // Skip the default "Select an option"
        const firstOptionValue = await firstOption.getAttribute('value');
        await locationSelect.selectOption(firstOptionValue || '');

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success and persistence
        await expect(userDetail.errorMessage).not.toBeVisible();
        // Don't check exact value since it's a generated ID, just verify it's not empty
        const selectedValue = await locationSelect.inputValue();
        expect(selectedValue).toBeTruthy();
        await userDetail.waitForSaveComplete();
    });

    test('Should display custom multiselect attribute and save form', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // * Verify Skills multiselect component is displayed
        const skillsColumn = userCard.getFieldInputByExactLabel('Skills');
        await expect(skillsColumn).toBeVisible();

        // # Make a change to a different field to trigger save state
        const departmentInput = userCard.getFieldInputByExactLabel('Department');
        await departmentInput.fill('Engineering Updated');

        // # Verify save button becomes enabled
        await expect(userDetail.saveButton).toBeEnabled();

        // # Save the form and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success (no error message)
        await expect(userDetail.errorMessage).not.toBeVisible();

        // * Verify save completed
        await userDetail.waitForSaveComplete();

        // * Verify the change persisted
        await expect(departmentInput).toHaveValue('Engineering Updated');
    });
});
