// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, duration, Msg} from '@mattermost/playwright-lib';

import {DOMAIN_NOT_ALLOWED, openLogin, signUp} from './support';

/**
 * Types the email in the invite dialog's people input, takes its "Add email" suggestion and sends the invite.
 */
async function inviteEmail(app: App, email: string) {
    const invite = app.invitationModal.invite;
    const input = invite.users.inputCombobox.locator;
    await input.click();
    await expect(input).toBeFocused();
    await input.pressSequentially(email, {delay: 50});

    // the menu offers the suggestion once its search finishes; Enter takes it
    await expect(invite.users.emailOption).toBeVisible({timeout: duration.half_min});
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await invite.sendButton.click();
    await expect(app.invitationModal.result.doneButton).toBeVisible();
}

/**
 * @objective Verify the create-account link is hidden and signup is blocked when user creation is disabled.
 */
test('MM-T1753 hides signup when user creation is disabled', {tag: '@authentication'}, async ({pw, page}) => {
    const {adminClient} = await pw.initSetup();

    await adminClient.patchConfig({
        TeamSettings: {EnableUserCreation: false},
        LdapSettings: {Enable: false},
    });

    const app = await openLogin(pw, page);

    // * Verify the create-account link is hidden
    await expect(app.login.alternate.actionLink).toBeHidden();

    // # Visit the signup page directly
    await app.signupPage.goto();

    // * Verify no sign-in methods are offered
    await expect(app.signup.noMethods.titleText).toBeVisible();
    await expect(app.signup.noMethods.titleText).toHaveMessage(Msg.login.noMethods.title);
});

/**
 * @objective Verify signup from the login page is rejected for a disallowed domain.
 */
test(
    'MM-T1754 rejects login-page signup when the email domain is not allowed',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.initSetup();

        await adminClient.patchConfig({
            EmailSettings: {RequireEmailVerification: false},
            TeamSettings: {RestrictCreationToDomains: 'test.com', EnableUserCreation: true},
        });

        const username = `Test${pw.random.id()}`;

        const app = await openLogin(pw, page);

        // # Open signup from the login-page create-account link
        await app.login.alternate.actionLink.click();
        await expect(app.signup.card.email.container).toBeVisible();
        await expect(app.signup.titleText).toHaveRole('heading');
        await expect(app.signup.titleText).toHaveMessage(Msg.signup_user_completed.title);
        await expect(app.signup.card.email.container).toBeVisible();
        await expect(app.signup.card.username.container).toBeVisible();
        await expect(app.signup.card.password.container).toBeVisible();
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
 * @objective Verify inviting an email outside the allowed domains is rejected.
 */
test('MM-T1755 rejects an email invite outside the allowed domains', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient, user, team, townSquare} = await pw.initSetup();

    await adminClient.patchConfig({
        EmailSettings: {RequireEmailVerification: false},
        ServiceSettings: {EnableEmailInvitations: true},
        TeamSettings: {RestrictCreationToDomains: 'test.com', EnableUserCreation: true},
    });

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Invite an email that is not on the allow list
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.invitePeopleMenuItem);
    await app.lhs.teamMenu.invitePeopleMenuItem.clickTo(app.invitationModal);
    const email = `test-${pw.random.id()}@mattermost.com`;
    await inviteEmail(app, email);

    // * Verify the invite is rejected for the disallowed domain
    await expect(app.invitationModal.result.notSent).toBeVisible();
    await expect(app.invitationModal.result.notSent).toContainText(
        `The following email addresses do not belong to an accepted domain: ${email}.`,
    );
});
