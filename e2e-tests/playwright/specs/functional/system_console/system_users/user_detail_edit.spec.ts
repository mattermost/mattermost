// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';

import {expect, test, SystemConsolePage} from '@mattermost/playwright-lib';

/**
 * @objective Verifies that authentication data field is displayed and editable for users with auth_service
 */
test('displays and allows editing of authentication data field', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Generate unique auth data to avoid unique constraint errors
    const originalAuthData = `auth-data-${await pw.random.id()}`;
    const newAuthData = `auth-data-${await pw.random.id()}`;

    // # Update user to have an auth service (simulate SAML/LDAP user)
    await adminClient.updateUserAuth(user.id, {
        auth_service: 'saml',
        auth_data: originalAuthData,
    });

    // # Navigate to user detail page
    await navigateToUserDetail(systemConsolePage, user);
    const {userDetail} = systemConsolePage.users;

    // * Verify auth data field is visible with correct value
    const {authDataInput} = userDetail.userCard;
    await expect(authDataInput).toBeVisible();
    await expect(authDataInput).toHaveValue(originalAuthData);

    // # Update the auth data value
    await authDataInput.clear();
    await authDataInput.fill(newAuthData);

    // * Verify Save button is enabled after change
    await expect(userDetail.saveButton).toBeEnabled();

    // # Click Save button and confirm
    await userDetail.save();
    await userDetail.saveChangesModal.confirm();

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
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Update user to have an auth service
    await adminClient.updateUserAuth(user.id, {
        auth_service: 'ldap',
        auth_data: `ldap-user-data-${await pw.random.id()}`,
    });

    // # Navigate to user detail page
    await navigateToUserDetail(systemConsolePage, user);
    const {userDetail} = systemConsolePage.users;

    // * Verify email and username fields are disabled and read-only
    const {emailInput, usernameInput} = userDetail.userCard;
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).toHaveAttribute('readonly', '');
    await expect(usernameInput).toBeDisabled();
    await expect(usernameInput).toHaveAttribute('readonly', '');

    // # Hover over email field to verify tooltip
    await emailInput.hover();
    const emailTooltip = systemConsolePage.page.getByText('This email is managed by the LDAP login provider');
    await expect(emailTooltip).toBeVisible();

    // # Hover over username field to verify tooltip
    await usernameInput.hover();
    const usernameTooltip = systemConsolePage.page.getByText('This username is managed by the LDAP login provider');
    await expect(usernameTooltip).toBeVisible();
});

/**
 * @objective Verifies that email and username fields are editable when user has no auth_service
 */
test('allows editing email and username fields for regular users', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to user detail page
    await navigateToUserDetail(systemConsolePage, user);
    const {userDetail} = systemConsolePage.users;
    const {userCard} = userDetail;

    // * Verify email and username fields are editable
    await expect(userCard.emailInput).toBeEnabled();
    await expect(userCard.usernameInput).toBeEnabled();

    // # Update both email and username
    const newEmail = `updated-${await pw.random.id()}@example.com`;
    const newUsername = `updated-${await pw.random.id()}`;

    await userCard.emailInput.clear();
    await userCard.emailInput.fill(newEmail);
    await userCard.usernameInput.clear();
    await userCard.usernameInput.fill(newUsername);

    // * Verify Save button is enabled after changes
    await expect(userDetail.saveButton).toBeEnabled();

    // # Click Save button and confirm
    await userDetail.save();
    await userDetail.saveChangesModal.confirm();

    // * Verify fields retain new values
    await expect(userCard.emailInput).toHaveValue(newEmail);
    await expect(userCard.usernameInput).toHaveValue(newUsername);

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
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to user detail page
    await navigateToUserDetail(systemConsolePage, user);
    const {userDetail} = systemConsolePage.users;
    const {userCard} = userDetail;

    // # Enter invalid email
    await userCard.emailInput.clear();
    await userCard.emailInput.fill('invalid-email');

    // * Verify email validation error appears
    const emailError = userCard.getFieldError('Email');
    await expect(emailError).toBeVisible();

    // * Verify Save button is disabled due to validation error
    await expect(userDetail.saveButton).toBeDisabled();

    // # Fix the email
    await userCard.emailInput.clear();
    await userCard.emailInput.fill('valid@example.com');

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
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to user detail page
    await navigateToUserDetail(systemConsolePage, user);
    const {userDetail} = systemConsolePage.users;

    // # Update email field
    const newEmail = `cancelled-${await pw.random.id()}@example.com`;
    await userDetail.userCard.emailInput.clear();
    await userDetail.userCard.emailInput.fill(newEmail);

    // # Click Save button
    await userDetail.save();

    // * Verify confirmation modal appears
    await userDetail.saveChangesModal.toBeVisible();

    // # Click Cancel
    await userDetail.saveChangesModal.cancel();
    await expect(userDetail.userCard.emailInput).toHaveValue(newEmail);

    // * Verify Save button is still enabled (unsaved changes remain)
    await expect(userDetail.saveButton).toBeEnabled();
});

/**
 * Navigate to the user detail page for a given user.
 */
async function navigateToUserDetail(systemConsolePage: SystemConsolePage, user: UserProfile) {
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.users.searchUsers(user.email);
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await expect(userRow.container.getByText(user.email)).toBeVisible();
    await userRow.container.getByText(user.email).click();

    await systemConsolePage.users.userDetail.toBeVisible();
}
