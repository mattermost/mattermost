// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {DOMAIN_NOT_ALLOWED, openLogin, openSignup, signUp} from './support';

const ALLOWED_DOMAINS = 'mattermost.com, test.com';

/**
 * @objective Verify open-team invite signup is rejected for a disallowed domain.
 *
 * @precondition
 * A licensed server.
 */
test(
    'MM-T1759 rejects open-team invite signup for a disallowed domain',
    {tag: '@authentication'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();

        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});
        await adminClient.updateTeam({...team, allow_open_invite: true});

        const username = `Test${pw.random.id()}`;

        const app = await openSignup(pw, page, `?id=${team.invite_id}`);

        // # Attempt signup with a disallowed-domain email
        await signUp(app, {
            email: `${username.toLowerCase()}@example.com`,
            username,
            password: pw.newTestPassword(),
        });

        // * Verify the domain restriction error is shown
        await expect(app.signup.banner).toBeVisible();
        await expect(app.signup.banner).toContainText(DOMAIN_NOT_ALLOWED);
    },
);

/**
 * @objective Verify the create-account link remains visible when email signup is off but LDAP is on.
 *
 * @precondition
 * A licensed server.
 */
test(
    'MM-T1761 keeps the create-account link when email signup is off and LDAP is on',
    {tag: '@authentication'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        await pw.ensureOpenldap();

        await adminClient.patchConfig({
            EmailSettings: {EnableSignUpWithEmail: false},
            LdapSettings: {Enable: true},
        });

        // # Open the login page with email signup off and LDAP on
        const app = await openLogin(pw, page);

        // * Verify the create-account link is still shown
        await expect(app.login.alternate.actionLink).toBeVisible();
    },
);

/**
 * @objective Verify email signup fields are shown when email account creation is enabled.
 *
 * @precondition
 * A licensed server.
 */
test(
    'MM-T1766 shows email signup fields when email account creation is enabled',
    {tag: '@authentication'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();

        await adminClient.patchConfig({
            EmailSettings: {EnableSignUpWithEmail: true},
            TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS},
        });

        // # Open invite signup with email account creation enabled
        const app = await openSignup(pw, page, `?id=${team.invite_id}`);

        // * Verify email signup fields are shown
        await expect(app.signup.card.email.container).toBeVisible();
        await expect(app.signup.card.email.container).toHaveAccessibleName('Email address');
        await expect(app.signup.card.password.container).toBeVisible();
        await expect(app.signup.card.password.container).toHaveAccessibleName('Choose a Password');
        await expect(app.signup.card.password.container).toHaveAttribute('placeholder', 'Choose a Password');
    },
);
