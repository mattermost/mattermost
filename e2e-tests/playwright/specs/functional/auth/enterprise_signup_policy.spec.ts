// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const ALLOWED_DOMAINS = 'mattermost.com, test.com';

/**
 * @objective Verify open-team invite signup is rejected for a disallowed domain.
 *
 * @precondition
 * A licensed server.
 */
test('rejects open-team invite signup for a disallowed domain', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, team} = await pw.initSetup();

    try {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});
        await adminClient.updateTeam({...team, allow_open_invite: true});

        const username = `Test${pw.random.id()}`;
        await pw.hasSeenLandingPage();
        await pw.signupPage.goto(`/signup_user_complete/?id=${team.invite_id}`);
        await pw.signupPage.toBeVisible();

        // # Attempt signup with a disallowed-domain email
        await pw.signupPage.create(
            {
                email: `${username.toLowerCase()}@example.com`,
                username,
                password: pw.newTestPassword(),
            },
            false,
        );

        // * Verify the domain restriction error is shown
        await expect(pw.signupPage.domainRestrictionError).toBeVisible();
    } finally {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ''}});
    }
});

/**
 * @objective Verify the create-account link remains visible when email signup is off but LDAP is on.
 *
 * @precondition
 * A licensed server.
 */
test(
    'keeps the create-account link when email signup is off and LDAP is on',
    {tag: '@authentication'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureOpenldap();

        const {adminClient} = await pw.initSetup();

        try {
            await adminClient.patchConfig({
                EmailSettings: {EnableSignUpWithEmail: false},
                LdapSettings: {Enable: true},
            });

            await pw.hasSeenLandingPage();
            await pw.loginPage.goto();
            await pw.loginPage.toBeVisible();

            // # Open the login page with email signup off and LDAP on
            // * Verify the create-account link is still shown
            await expect(pw.loginPage.createAccountLink).toBeVisible();
        } finally {
            await adminClient.patchConfig({EmailSettings: {EnableSignUpWithEmail: true}});
        }
    },
);

/**
 * @objective Verify email signup fields are shown when email account creation is enabled.
 *
 * @precondition
 * A licensed server.
 */
test('shows email signup fields when email account creation is enabled', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, team} = await pw.initSetup();

    try {
        await adminClient.patchConfig({
            EmailSettings: {EnableSignUpWithEmail: true},
            TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS},
        });

        await pw.hasSeenLandingPage();
        await pw.signupPage.goto(`/signup_user_complete/?id=${team.invite_id}`);
        await pw.signupPage.toBeVisible();

        // # Open invite signup with email account creation enabled
        // * Verify email signup fields are shown
        await expect(pw.signupPage.emailAddressLabel).toBeVisible();
        await expect(pw.signupPage.choosePasswordPlaceholder).toBeVisible();
    } finally {
        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ''}});
    }
});
