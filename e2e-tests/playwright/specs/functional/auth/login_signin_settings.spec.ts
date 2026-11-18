// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {openLogin} from './support';

/**
 * @objective Verify the login placeholder is Email when only email sign-in is enabled.
 */
test(
    'MM-T1769 login placeholder is Email when username sign-in is disabled',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Allow only email sign-in
        const {restore} = await adminClient.patchConfig({
            EmailSettings: {EnableSignInWithEmail: true, EnableSignInWithUsername: false},
            LdapSettings: {Enable: false},
        });

        try {
            const app = await openLogin(pw, page);

            // * Verify the field is named Email
            await expect(app.login.loginId.container).toBeVisible();
            await expect(app.login.loginId.container).toHaveAccessibleName('Email');
        } finally {
            // Admin logs in by username.
            await restore();
        }
    },
);

/**
 * @objective Verify the login placeholder is Username when only username sign-in is enabled.
 */
test(
    'MM-T1767 login placeholder is Username when email sign-in is disabled',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Allow only username sign-in
        await adminClient.patchConfig({
            EmailSettings: {EnableSignInWithEmail: false, EnableSignInWithUsername: true},
            LdapSettings: {Enable: false},
        });

        const app = await openLogin(pw, page);

        // * Verify the field is named Username
        await expect(app.login.loginId.container).toBeVisible();
        await expect(app.login.loginId.container).toHaveAccessibleName('Username');
    },
);

/**
 * @objective Verify the login placeholder is Email or Username when both sign-in methods are enabled.
 */
test(
    'MM-T1768 login placeholder is Email or Username when both sign-in methods are enabled',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Allow both email and username sign-in
        await adminClient.patchConfig({
            EmailSettings: {EnableSignInWithEmail: true, EnableSignInWithUsername: true},
            LdapSettings: {Enable: false},
        });

        const app = await openLogin(pw, page);

        // * Verify the field is named Email or Username
        await expect(app.login.loginId.container).toBeVisible();
        await expect(app.login.loginId.container).toHaveAccessibleName('Email or Username');
    },
);
