// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {navigateToUserDetail} from './support';

/**
 * @objective Verifies that authentication data field is displayed and editable for users with auth_service
 */
test('displays and allows editing of authentication data field', {tag: '@user_management'}, async ({pw}) => {
    const {user, adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Generate unique auth data to avoid unique constraint errors
    const originalAuthData = `auth-data-${pw.random.id()}`;
    const newAuthData = `auth-data-${pw.random.id()}`;

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
        auth_data: `ldap-user-data-${pw.random.id()}`,
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
