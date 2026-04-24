// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {navigateToUserDetail} from './support';

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
    const newEmail = `updated-${pw.random.id()}@example.com`;
    const newUsername = `updated-${pw.random.id()}`;

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
    const newEmail = `cancelled-${pw.random.id()}@example.com`;
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
