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

import {cleanupAdminEditingTest, setupAdminEditingTest, testUserAttributes} from './support';

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

    test('MM-65126 Should edit custom user attributes from system console', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find and edit Department field (custom text attribute)
        const departmentInput = userCard.getFieldInputByExactLabel('Department');
        await departmentInput.clear();
        await departmentInput.fill('Marketing');

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success (no error message and field retains new value)
        await expect(userDetail.errorMessage).not.toBeVisible();
        await expect(departmentInput).toHaveValue('Marketing');

        // * Verify Save button becomes disabled after successful save
        await userDetail.waitForSaveComplete();
    });

    test('Should display user attributes in two-column layout', async () => {
        const {userCard} = systemConsolePage.users.userDetail;

        // * Verify two-column layout exists
        await expect(userCard.twoColumnLayout).toBeVisible();

        // * Verify system fields are present
        await expect(userCard.usernameInput).toBeVisible();
        await expect(userCard.emailInput).toBeVisible();
        await expect(userCard.authenticationMethod).toBeVisible();

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
        const rowCount = await userCard.fieldRows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test('Should edit system email attribute and save', async () => {
        const {userDetail} = systemConsolePage.users;
        const {emailInput} = userDetail.userCard;

        // # Enter new valid email
        const newEmail = `updated-${testUser.email}`;
        await emailInput.clear();
        await emailInput.fill(newEmail);

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success
        await expect(userDetail.errorMessage).not.toBeVisible();
        await expect(emailInput).toHaveValue(newEmail);
        await userDetail.waitForSaveComplete();
    });
});
