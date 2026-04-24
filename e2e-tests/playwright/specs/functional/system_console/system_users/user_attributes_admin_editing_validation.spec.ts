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

    test('Should validate invalid email and show error with cancel option', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find CPA email field (Work Email)
        const workEmailInput = userCard.getFieldInputByExactLabel('Work Email');
        const originalEmail = await workEmailInput.inputValue();

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email');

        // * Verify inline validation error appears
        const fieldError = userCard.getFieldError('Work Email');
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText('Invalid email address');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is visible and enabled
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Test the cancel functionality
        await userDetail.cancel();

        // * Verify email reverts to original value
        await expect(workEmailInput).toHaveValue(originalEmail);

        // * Verify validation error disappears
        await expect(fieldError).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();

        // * Verify Save button remains disabled (no unsaved changes)
        await expect(userDetail.saveButton).toBeDisabled();
    });

    test('Should validate invalid URL and show error with cancel option', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find custom URL field (Personal Website)
        const urlInput = userCard.getFieldInputByExactLabel('Personal Website');
        const originalUrl = await urlInput.inputValue();

        // # Enter invalid URL (specifically the one mentioned: "<%>")
        await urlInput.clear();
        await urlInput.fill('<%>');

        // * Verify inline validation error appears
        const fieldError = userCard.getFieldError('Personal Website');
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText('Invalid URL');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is visible
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Test cancel functionality
        await userDetail.cancel();

        // * Verify URL reverts to original value
        await expect(urlInput).toHaveValue(originalUrl);

        // * Verify validation error disappears
        await expect(fieldError).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();
    });

    test('Should validate invalid email in custom email attribute', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find custom email field (Work Email)
        const workEmailInput = userCard.getFieldInputByExactLabel('Work Email');

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email-either');

        // * Verify inline validation error appears
        const fieldError = userCard.getFieldError('Work Email');
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText('Invalid email address');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is available
        await expect(userDetail.cancelButton).toBeVisible();
    });
});
