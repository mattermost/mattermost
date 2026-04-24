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

import {UserProfile} from '@mattermost/types/users';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test, SystemConsolePage} from '@mattermost/playwright-lib';

import {cleanupAdminEditingTest, setupAdminEditingTest} from './support';

let testUser: UserProfile;
let attributeFieldsMap: Record<string, UserPropertyField>;
let systemConsolePage: SystemConsolePage;

test.describe('System Console - Admin User Profile Editing', () => {
    test.beforeEach(async ({pw}) => {
        ({systemConsolePage, testUser, attributeFieldsMap} = await setupAdminEditingTest(pw));
    });

    test.afterEach(async ({pw}) => {
        await cleanupAdminEditingTest(pw, attributeFieldsMap);
    });

    test('Should show save/cancel buttons when changes are made', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // * Initially, Save should be disabled and Cancel should not be visible
        await expect(userDetail.saveButton).toBeDisabled();
        await expect(userDetail.cancelButton).not.toBeVisible();

        // # Make a change to trigger save needed state
        const departmentInput = userCard.getFieldInputByExactLabel('Department');
        const originalValue = await departmentInput.inputValue();
        await departmentInput.clear();
        await departmentInput.fill('Changed Value');

        // * Verify Save button becomes enabled and Cancel button appears
        await expect(userDetail.saveButton).toBeEnabled();
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Click Cancel
        await userDetail.cancel();

        // * Verify changes are reverted
        await expect(departmentInput).toHaveValue(originalValue);

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();

        // * Verify Save button is disabled
        await expect(userDetail.saveButton).toBeDisabled();
    });

    test('Should save all user attribute changes atomically', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Make changes to both system and custom attributes
        const newEmail = `atomic-test-${testUser.email}`;
        await userCard.emailInput.clear();
        await userCard.emailInput.fill(newEmail);

        const departmentInput = userCard.getFieldInputByExactLabel('Department');
        await departmentInput.clear();
        await departmentInput.fill('Sales');

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify both changes were saved successfully
        await expect(userDetail.errorMessage).not.toBeVisible();
        await expect(userCard.emailInput).toHaveValue(newEmail);
        await expect(departmentInput).toHaveValue('Sales');
        await userDetail.waitForSaveComplete();
    });
});
