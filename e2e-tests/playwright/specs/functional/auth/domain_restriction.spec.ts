// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {DOMAIN_NOT_ALLOWED, expectOnSelectTeam, openSignup, signUp} from './support';

const ALLOWED_DOMAINS = 'mattermost.com, test.com';

/**
 * @objective Verify signup succeeds when the email belongs to an allowed domain.
 */
test(
    'MM-T1756 allows signup when the email domain is on the allow list',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient} = await pw.initSetup();

        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});

        const username = `test${pw.random.id()}`;

        const app = await openSignup(pw, page);

        // # Create an account with an allowed-domain email
        await signUp(app, {
            email: `${username}@mattermost.com`,
            username,
            password: pw.newTestPassword(),
        });

        // * Verify the account is created and the team-join page is shown
        await expectOnSelectTeam(page);
    },
);

/**
 * @objective Verify changing a profile email to a disallowed domain is rejected.
 */
test('MM-T1757 rejects a profile email change to a disallowed domain', {tag: '@authentication'}, async ({pw}) => {
    const {adminClient, user, team, townSquare} = await pw.initSetup();

    await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Try to change the profile email to a disallowed domain
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
    await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    const email = app.settings.general.section('email');
    await email.editButton.clickTo(email.newEmail.container);
    const newEmail = `user-${pw.random.id()}@example.com`;
    await email.newEmail.container.fill(newEmail);
    await expect(email.newEmail.container).toHaveValue(newEmail);
    await email.confirmEmail.container.fill(newEmail);
    await expect(email.confirmEmail.container).toHaveValue(newEmail);
    await email.currentPassword.container.fill(user.password);
    await expect(email.currentPassword.container).toHaveValue(user.password);
    await expect(email.saveButton).toBeEnabled();
    await settle(email.saveButton, {wait: Api.PatchUserMe, status: 400}).click();

    // * Verify the domain restriction error is shown
    await expect(email.serverErrorText).toBeVisible();
    await expect(email.serverErrorText).toHaveText(DOMAIN_NOT_ALLOWED);
});

/**
 * @objective Verify signup through a team invite is rejected for a disallowed domain.
 */
test(
    'MM-T1758 rejects team-invite signup when the email domain is not allowed',
    {tag: '@authentication'},
    async ({pw, page}) => {
        const {adminClient, team} = await pw.initSetup();

        await adminClient.patchConfig({TeamSettings: {RestrictCreationToDomains: ALLOWED_DOMAINS}});

        const username = `test${pw.random.id()}`;

        const app = await openSignup(pw, page, `?id=${team.invite_id}`);

        // # Attempt signup with a disallowed-domain email
        await signUp(app, {
            email: `${username}@example.com`,
            username,
            password: pw.newTestPassword(),
        });

        // * Verify the domain restriction error is shown
        await expect(app.signup.banner).toBeVisible();
        await expect(app.signup.banner).toContainText(DOMAIN_NOT_ALLOWED);
    },
);
