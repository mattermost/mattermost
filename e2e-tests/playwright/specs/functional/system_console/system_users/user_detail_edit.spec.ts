// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {expect, openSystemUsers, type PlaywrightExtended, searchSystemUsers, test} from '@mattermost/playwright-lib';

/**
 * @objective Verifies that authentication data field is displayed and editable for users with auth_service
 */
test('displays and allows editing of authentication data field', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser, adminClient} = await pw.initSetup();

    // # Generate unique auth data to avoid unique constraint errors
    const originalAuthData = `auth-data-${pw.random.id()}`;
    const newAuthData = `auth-data-${pw.random.id()}`;

    // # Update user to have an auth service (simulate SAML/LDAP user)
    await adminClient.updateUserAuth(user.id, {
        auth_service: 'saml',
        auth_data: originalAuthData,
    });

    // # Navigate to user detail page
    const userDetail = await navigateToUserDetail(pw, adminUser, user);

    // * Verify auth data field is visible with correct value
    const authDataInput = userDetail.authDataTextbox.locator;
    await expect(authDataInput).toBeVisible();
    await expect(authDataInput).toHaveValue(originalAuthData);

    // # Update the auth data value
    await authDataInput.clear();
    await authDataInput.fill(newAuthData);

    // * Verify Save button is enabled after change
    await expect(userDetail.saveButton).toBeEnabled();

    // # Click Save button and confirm
    const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
    await confirm.confirmButton.click();

    // * Verify the auth data field retains new value
    await expect(authDataInput).toHaveValue(newAuthData);

    // * Verify the change was saved by checking API
    const updatedUser = await adminClient.getUser(user.id);
    expect(updatedUser.auth_data).toBe(newAuthData);
});

/**
 * @objective Verifies that email and username fields are disabled with tooltips when user has auth_service
 */
test('disables email and username fields for users with auth service', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser, adminClient} = await pw.initSetup();

    // # Update user to have an auth service
    await adminClient.updateUserAuth(user.id, {
        auth_service: 'ldap',
        auth_data: `ldap-user-data-${pw.random.id()}`,
    });

    // # Navigate to user detail page
    const userDetail = await navigateToUserDetail(pw, adminUser, user);

    // * Verify email and username fields are disabled and read-only
    const emailInput = userDetail.emailTextbox.locator;
    const usernameInput = userDetail.usernameTextbox.locator;
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).toHaveAttribute('readonly', '');
    await expect(usernameInput).toBeDisabled();
    await expect(usernameInput).toHaveAttribute('readonly', '');

    // # Hover over email field to verify tooltip
    await emailInput.hover();
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the tooltip comes from the shared WithTooltip, which takes no test id and renders outside the user detail scope; it is read by its ARIA role
    const tooltip = userDetail.page.getByRole('tooltip');
    await expect(tooltip).toContainText('This email is managed by the LDAP login provider');

    // # Hover over username field to verify tooltip
    await usernameInput.hover();
    await expect(tooltip).toContainText('This username is managed by the LDAP login provider');
});

/**
 * @objective Verifies that email and username fields are editable when user has no auth_service
 */
test('allows editing email and username fields for regular users', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser, adminClient} = await pw.initSetup();

    // # Navigate to user detail page
    const userDetail = await navigateToUserDetail(pw, adminUser, user);

    // * Verify email and username fields are editable
    await expect(userDetail.emailTextbox).toBeEnabled();
    await expect(userDetail.usernameTextbox).toBeEnabled();

    // # Update both email and username
    const newEmail = `updated-${pw.random.id()}@example.com`;
    const newUsername = `updated-${pw.random.id()}`;

    await userDetail.emailTextbox.clear();
    await userDetail.emailTextbox.fill(newEmail);
    await userDetail.usernameTextbox.clear();
    await userDetail.usernameTextbox.fill(newUsername);

    // * Verify Save button is enabled after changes
    await expect(userDetail.saveButton).toBeEnabled();

    // # Click Save button and confirm
    const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
    await confirm.confirmButton.click();

    // * Verify fields retain new values
    await expect(userDetail.emailTextbox).toHaveValue(newEmail);
    await expect(userDetail.usernameTextbox).toHaveValue(newUsername);

    // * Verify the changes were saved by checking API
    const updatedUser = await adminClient.getUser(user.id);
    expect(updatedUser.email).toBe(newEmail);
    expect(updatedUser.username).toBe(newUsername);
});

/**
 * @objective Verifies inline validation for email field
 */
test('displays inline validation errors for invalid email', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser} = await pw.initSetup();

    // # Navigate to user detail page
    const userDetail = await navigateToUserDetail(pw, adminUser, user);

    // # Enter invalid email
    await userDetail.emailTextbox.clear();
    await userDetail.emailTextbox.fill('invalid-email');

    // * Verify email validation error appears
    const emailError = userDetail.emailErrorAlert.locator;
    await expect(emailError).toBeVisible();

    // * Verify Save button is disabled due to validation error
    await expect(userDetail.saveButton).toBeDisabled();

    // # Fix the email
    await userDetail.emailTextbox.clear();
    await userDetail.emailTextbox.fill('valid@example.com');

    // * Verify email error disappears
    await expect(emailError).not.toBeVisible();

    // * Verify Save button is now enabled
    await expect(userDetail.saveButton).toBeEnabled();
});

/**
 * @objective Verifies confirmation dialog can be cancelled
 */
test('allows cancelling save confirmation dialog', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser} = await pw.initSetup();

    // # Navigate to user detail page
    const userDetail = await navigateToUserDetail(pw, adminUser, user);

    // # Update email field
    const newEmail = `cancelled-${pw.random.id()}@example.com`;
    await userDetail.emailTextbox.clear();
    await userDetail.emailTextbox.fill(newEmail);

    // # Click Save button
    const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);

    // * Verify confirmation modal appears
    await expect(confirm.cancelButton).toBeVisible();

    // # Click Cancel
    await confirm.cancelButton.click();
    await expect(confirm.cancelButton).not.toBeVisible();
    await expect(userDetail.emailTextbox).toHaveValue(newEmail);

    // * Verify Save button is still enabled (unsaved changes remain)
    await expect(userDetail.saveButton).toBeEnabled();
});

/**
 * Navigate to the user detail page for a given user.
 */
async function navigateToUserDetail(pw: PlaywrightExtended, admin: UserProfile, user: UserProfile) {
    const app = await openSystemUsers(pw, admin);
    await searchSystemUsers(app, user.email, user);
    await app.admin.users.table.row(user.id).cell('emailColumn').click();
    await expect(app.admin.user.emailTextbox).toBeVisible();
    return app.admin.user;
}
