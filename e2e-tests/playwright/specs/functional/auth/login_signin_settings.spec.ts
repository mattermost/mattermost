// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const restoreSignInSettings = {
    EmailSettings: {EnableSignInWithEmail: true, EnableSignInWithUsername: true},
    LdapSettings: {Enable: false},
};

/**
 * @objective Verify the login placeholder is Email when only email sign-in is enabled.
 */
test(
    'MM-T1769 login placeholder is Email when username sign-in is disabled',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        try {
            // # Allow only email sign-in
            await adminClient.patchConfig({
                EmailSettings: {EnableSignInWithEmail: true, EnableSignInWithUsername: false},
                LdapSettings: {Enable: false},
            });

            await pw.hasSeenLandingPage();
            await pw.loginPage.goto();
            await pw.loginPage.toBeVisible();

            // * Verify the placeholder is Email
            await expect(pw.loginPage.emailOnlyPlaceholder).toBeVisible();
        } finally {
            await adminClient.patchConfig(restoreSignInSettings);
        }
    },
);

/**
 * @objective Verify the login placeholder is Username when only username sign-in is enabled.
 */
test(
    'MM-T1767 login placeholder is Username when email sign-in is disabled',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        try {
            // # Allow only username sign-in
            await adminClient.patchConfig({
                EmailSettings: {EnableSignInWithEmail: false, EnableSignInWithUsername: true},
                LdapSettings: {Enable: false},
            });

            await pw.hasSeenLandingPage();
            await pw.loginPage.goto();
            await pw.loginPage.toBeVisible();

            // * Verify the placeholder is Username
            await expect(pw.loginPage.usernameOnlyPlaceholder).toBeVisible();
        } finally {
            await adminClient.patchConfig(restoreSignInSettings);
        }
    },
);

/**
 * @objective Verify the login placeholder is Email or Username when both sign-in methods are enabled.
 */
test(
    'MM-T1768 login placeholder is Email or Username when both sign-in methods are enabled',
    {tag: '@authentication'},
    async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        try {
            // # Allow both email and username sign-in
            await adminClient.patchConfig({
                EmailSettings: {EnableSignInWithEmail: true, EnableSignInWithUsername: true},
                LdapSettings: {Enable: false},
            });

            await pw.hasSeenLandingPage();
            await pw.loginPage.goto();
            await pw.loginPage.toBeVisible();

            // * Verify the placeholder is Email or Username
            await expect(pw.loginPage.loginPlaceholder).toBeVisible();
        } finally {
            await adminClient.patchConfig(restoreSignInSettings);
        }
    },
);
