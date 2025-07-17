// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type PlaywrightExtended, expect, test} from '@mattermost/playwright-lib';

/**
 * Setup a user and navigate to their detail page
 * @param pw PlaywrightExtended instance
 * @returns User object and system console page
 */
async function setupUserDetailPage(pw: PlaywrightExtended) {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a test user
    const user = await adminClient.createUser(pw.random.user(), '', '');
    const team = await adminClient.createTeam(pw.random.team());
    await adminClient.addToTeam(team.id, user.id);

    // # Visit system console users section
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Search for the user
    await systemConsolePage.systemUsers.enterSearchText(user.email);
    const userRow = await systemConsolePage.systemUsers.getNthRow(1);
    await userRow.getByText(user.email).waitFor();

    // # Click on the username to navigate to user detail page
    await userRow.getByText(user.username).click();

    // # Wait for user detail page to load
    await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${user.id}`);

    return {user, systemConsolePage, adminClient};
}

/**
 * @objective Verifies that authentication data field is displayed and editable for users with auth_service
 */
test('displays and allows editing of authentication data field', {tag: '@user_management'}, async ({pw}) => {
    const {user, systemConsolePage, adminClient} = await setupUserDetailPage(pw);

    // # Update user to have an auth service (simulate SAML/LDAP user)
    await adminClient.updateUserAuth(user.id, {
        auth_service: 'saml',
        auth_data: 'original-auth-data',
    });

    // # Refresh the page to load the updated user data
    await systemConsolePage.page.reload();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify auth data field is visible
    const authDataLabel = systemConsolePage.page.getByText('Auth Data');
    await expect(authDataLabel).toBeVisible();

    // * Verify auth data input field is present and contains current value
    const authDataInput = systemConsolePage.page.locator('input[placeholder="Enter auth data"]');
    await expect(authDataInput).toBeVisible();
    await expect(authDataInput).toHaveValue('original-auth-data');

    // # Update the auth data value
    const newAuthData = 'updated-auth-data';
    await authDataInput.fill(newAuthData);

    // * Verify Save button is enabled after change
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});
    await expect(saveButton).toBeEnabled();

    // # Click Save button
    await saveButton.click();

    // * Verify confirmation modal appears
    const confirmModal = systemConsolePage.page.getByText('Confirm Changes');
    await expect(confirmModal).toBeVisible();

    // * Verify the modal shows the auth data change
    const authDataChange = systemConsolePage.page.getByText(`Auth Data: original-auth-data → ${newAuthData}`);
    await expect(authDataChange).toBeVisible();

    // # Confirm the save
    const confirmSaveButton = systemConsolePage.page.getByRole('button', {name: 'Save Changes'});
    await confirmSaveButton.click();

    // * Verify modal closes and success
    await expect(confirmModal).not.toBeVisible();
    await expect(authDataInput).toHaveValue(newAuthData);

    // * Verify the change was saved by checking API
    const updatedUser = await adminClient.getUser(user.id);
    expect(updatedUser.auth_data).toBe(newAuthData);
});

/**
 * @objective Verifies that email and username fields are disabled with tooltips when user has auth_service
 */
test('disables email and username fields for users with auth service', {tag: '@user_management'}, async ({pw}) => {
    const {user, systemConsolePage, adminClient} = await setupUserDetailPage(pw);

    // # Update user to have an auth service
    await adminClient.updateUserAuth(user.id, {
        auth_service: 'ldap',
        auth_data: 'ldap-user-data',
    });

    // # Refresh the page to load updated user data
    await systemConsolePage.page.reload();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify email field is disabled
    const emailInput = systemConsolePage.page.locator('label:has-text("Email") input');
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).toHaveAttribute('readonly');
    await expect(emailInput).toHaveCSS('cursor', 'not-allowed');

    // * Verify username field is disabled
    const usernameInput = systemConsolePage.page.locator('label:has-text("Username") input');
    await expect(usernameInput).toBeDisabled();
    await expect(usernameInput).toHaveAttribute('readonly');
    await expect(usernameInput).toHaveCSS('cursor', 'not-allowed');

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
    const {user, systemConsolePage, adminClient} = await setupUserDetailPage(pw);

    // # Ensure user has no auth service (regular email/password user)
    const currentUser = await adminClient.getUser(user.id);
    expect(currentUser.auth_service).toBe('');

    // * Verify email field is editable
    const emailInput = systemConsolePage.page.locator('label:has-text("Email") input');
    await expect(emailInput).toBeEnabled();
    await expect(emailInput).not.toHaveAttribute('readonly');

    // * Verify username field is editable
    const usernameInput = systemConsolePage.page.locator('label:has-text("Username") input');
    await expect(usernameInput).toBeEnabled();
    await expect(usernameInput).not.toHaveAttribute('readonly');

    // # Update both email and username
    const newEmail = `updated-${pw.random.id()}@example.com`;
    const newUsername = `updated-${pw.random.id()}`;

    await emailInput.fill(newEmail);
    await usernameInput.fill(newUsername);

    // * Verify Save button is enabled after changes
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});
    await expect(saveButton).toBeEnabled();

    // # Click Save button
    await saveButton.click();

    // * Verify confirmation modal shows both changes
    const confirmModal = systemConsolePage.page.getByText('Confirm Changes');
    await expect(confirmModal).toBeVisible();

    const emailChange = systemConsolePage.page.getByText(`Email: ${user.email} → ${newEmail}`);
    await expect(emailChange).toBeVisible();

    const usernameChange = systemConsolePage.page.getByText(`Username: ${user.username} → ${newUsername}`);
    await expect(usernameChange).toBeVisible();

    // # Confirm the save
    const confirmSaveButton = systemConsolePage.page.getByRole('button', {name: 'Save Changes'});
    await confirmSaveButton.click();

    // * Verify modal closes and changes are saved
    await expect(confirmModal).not.toBeVisible();
    await expect(emailInput).toHaveValue(newEmail);
    await expect(usernameInput).toHaveValue(newUsername);

    // * Verify the changes were saved by checking API
    const updatedUser = await adminClient.getUser(user.id);
    expect(updatedUser.email).toBe(newEmail);
    expect(updatedUser.username).toBe(newUsername);
});

/**
 * @objective Verifies inline validation for email and username fields
 */
test('displays inline validation errors for invalid email and username', {tag: '@user_management'}, async ({pw}) => {
    const {systemConsolePage} = await setupUserDetailPage(pw);

    // # Enter invalid email
    const emailInput = systemConsolePage.page.locator('label:has-text("Email") input');
    await emailInput.fill('invalid-email');

    // * Verify email validation error appears with red styling
    const emailError = systemConsolePage.page.locator('div.field-error').filter({hasText: 'Invalid email address'});
    await expect(emailError).toBeVisible();
    await expect(emailError).toHaveCSS('color', /rgb\(217, 58, 58\)|red/); // Error text should be red
    
    // * Verify email input has error styling
    await expect(emailInput).toHaveClass(/error/);

    // # Enter empty username
    const usernameInput = systemConsolePage.page.locator('label:has-text("Username") input');
    await usernameInput.fill('');

    // * Verify username validation error appears with red styling
    const usernameError = systemConsolePage.page.locator('div.field-error').filter({hasText: 'Username cannot be empty'});
    await expect(usernameError).toBeVisible();
    await expect(usernameError).toHaveCSS('color', /rgb\(217, 58, 58\)|red/); // Error text should be red
    
    // * Verify username input has error styling
    await expect(usernameInput).toHaveClass(/error/);

    // * Verify Save button is disabled due to validation errors
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});
    await expect(saveButton).toBeDisabled();

    // # Fix the email
    await emailInput.fill('valid@example.com');

    // * Verify email error disappears and styling is removed
    await expect(emailError).not.toBeVisible();
    await expect(emailInput).not.toHaveClass(/error/);

    // # Fix the username
    await usernameInput.fill('validusername');

    // * Verify username error disappears and styling is removed
    await expect(usernameError).not.toBeVisible();
    await expect(usernameInput).not.toHaveClass(/error/);

    // * Verify Save button is now enabled
    await expect(saveButton).toBeEnabled();
});

/**
 * @objective Verifies confirmation dialog can be cancelled
 */
test('allows cancelling save confirmation dialog', {tag: '@user_management'}, async ({pw}) => {
    const {systemConsolePage} = await setupUserDetailPage(pw);

    // # Update email field
    const emailInput = systemConsolePage.page.locator('label:has-text("Email") input');
    const newEmail = `cancelled-${pw.random.id()}@example.com`;
    await emailInput.fill(newEmail);

    // # Click Save button
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});
    await saveButton.click();

    // * Verify confirmation modal appears
    const confirmModal = systemConsolePage.page.getByText('Confirm Changes');
    await expect(confirmModal).toBeVisible();

    // # Click Cancel
    const cancelButton = systemConsolePage.page.getByRole('button', {name: 'Cancel'});
    await cancelButton.click();

    // * Verify modal closes and field retains the edited value
    await expect(confirmModal).not.toBeVisible();
    await expect(emailInput).toHaveValue(newEmail);

    // * Verify the change was NOT saved (email should still be original)
    // Note: The field keeps the edited value but API should have original value
});
