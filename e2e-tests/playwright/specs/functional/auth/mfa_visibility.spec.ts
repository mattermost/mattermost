// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type PlaywrightExtended, DefaultChannel} from '@mattermost/playwright-lib';

import {expectOnSelectTeam, logIn, openLogin} from './support';

type Setup = Awaited<ReturnType<PlaywrightExtended['initSetup']>>;

/** Logs the user in and opens Profile > Security. */
async function openSecurity(pw: PlaywrightExtended, {user, team}: Pick<Setup, 'user' | 'team'>) {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
    await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    await app.userSettingsModal.tabs.tab('security').select();
    await expect(app.settings.security.section('password')).toBeVisible();
    return app;
}

/**
 * @objective Verify the MFA section is hidden in Profile when MFA is disabled.
 *
 * @precondition
 * A licensed server.
 */
test(
    'MM-T1777 hides MFA in Profile when multifactor authentication is disabled',
    {tag: '@authentication'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {user, team} = await pw.initSetup();

        // # Open Profile > Security
        const app = await openSecurity(pw, {user, team});

        // * Verify the MFA section is hidden
        await expect(app.settings.security.section('mfa')).toBeHidden();
    },
);

/**
 * @objective Verify the MFA section is shown in Profile when MFA is enabled.
 *
 * @precondition
 * A licensed server.
 */
test(
    'MM-T1779 shows MFA in Profile when multifactor authentication is enabled',
    {tag: '@authentication'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {user, adminClient, team} = await pw.initSetup();

        const {restore} = await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });

        try {
            // # Open Profile > Security
            const app = await openSecurity(pw, {user, team});

            // * Verify the MFA section is shown
            await expect(app.settings.security.section('mfa')).toBeVisible();
        } finally {
            await restore();
        }
    },
);

/**
 * @objective Verify login skips MFA when it is enabled but not enforced.
 *
 * @precondition
 * A licensed server.
 */
test(
    'MM-T1780 logs in without an MFA prompt when MFA is not enforced',
    {tag: '@authentication'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        const user = await pw.createNewUserProfile(adminClient);

        const {restore} = await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
        });

        try {
            // # Log in as a user without MFA
            const app = await openLogin(pw, page);
            await logIn(app, user.username, user.password);

            // * Verify login goes straight to the team-join page, without MFA
            await expectOnSelectTeam(page);
        } finally {
            await restore();
        }
    },
);
