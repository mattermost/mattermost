// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getRecentEmail, test, Msg} from '@mattermost/playwright-lib';

import {expectOnSelectTeam, openSignup, signUp} from './support';

/**
 * @objective Verify signup without email verification lands on the team-join page.
 */
test(
    'MM-T1763 signup without email verification lands on the team-join page',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.initSetup();

        await adminClient.patchConfig({EmailSettings: {RequireEmailVerification: false}});

        const username = `Test${pw.random.id()}`;
        const email = `${username.toLowerCase()}@example.com`;
        const started = new Date();

        const app = await openSignup(pw, page);

        // # Create an account while verification is not required
        await signUp(app, {email, username, password: pw.newTestPassword()});

        // * Verify the team-join page is shown
        await expectOnSelectTeam(page);

        // * Verify a join email was still sent
        const mail = await getRecentEmail(email, {receivedAfter: started});
        expect(mail.subject).toContain('You joined');
    },
);

/**
 * @objective Verify email signup fields are hidden when email account creation is disabled.
 */
test(
    'MM-T1765 hides email signup when email account creation is disabled',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient, team} = await pw.initSetup();

        await adminClient.patchConfig({
            EmailSettings: {EnableSignUpWithEmail: false},
            GitLabSettings: {Enable: true},
        });

        // # Open signup while email account creation is disabled
        const app = await openSignup(pw, page, `?id=${team.invite_id}`, {form: false});

        // * Verify GitLab is offered and email signup fields are hidden
        await expect(app.signup.card.titleText).toBeVisible();
        await expect(app.signup.card.titleText).toHaveMessage(Msg.signup_user_completed.cardtitle.external);
        await expect(app.signup.external('gitlab')).toBeVisible();
        await expect(app.signup.card.email.container).toBeHidden();
        await expect(app.signup.card.password.container).toBeHidden();
    },
);

/**
 * @objective Verify account creation succeeds when EnableUserCreation is true.
 */
test('MM-T1752 creates an account when user creation is enabled', {tag: '@authentication'}, async ({pw, page}) => {
    const {adminClient} = await pw.initSetup();

    await adminClient.patchConfig({TeamSettings: {EnableUserCreation: true}});

    const username = `Test${pw.random.id()}`;

    const app = await openSignup(pw, page);

    // # Create an account
    await signUp(app, {
        email: `${username.toLowerCase()}@example.com`,
        username,
        password: pw.newTestPassword(),
    });

    // * Verify the team-join page is shown
    await expectOnSelectTeam(page);
});
