// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    duration,
    expect,
    openSystemUsers,
    searchSystemUsers,
    settle,
    test,
    testConfig,
} from '@mattermost/playwright-lib';

import {expectOnSelectTeam, logIn, openAdminConsole, openLogin} from './support';

/**
 * @objective Verify enforced MFA sends an unenrolled user to MFA setup after login.
 *
 * @precondition
 * A licensed server running in testcontainers.
 */
test(
    'MM-T1778 sends an unenrolled user to MFA setup when MFA is enforced',
    {tag: '@authentication'},
    async ({pw, page}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        test.skip(!testConfig.mattermostContainerId, 'Skipping test - requires PW_USE_TESTCONTAINERS=true');

        const {adminUser, adminClient} = await pw.initSetup();
        const user = await pw.createNewUserProfile(adminClient);
        const {app: adminApp} = await pw.testBrowser.login(adminUser);

        try {
            // # Enable and enforce MFA in the System Console
            await openAdminConsole(adminApp, '/authentication/mfa');
            await adminApp.admin.setting('ServiceSettings.EnableMultifactorAuthentication').trueRadio.check();
            await expect(
                adminApp.admin.setting('ServiceSettings.EnableMultifactorAuthentication').trueRadio,
            ).toBeChecked();
            await adminApp.admin.setting('ServiceSettings.EnforceMultifactorAuthentication').trueRadio.check();
            await expect(
                adminApp.admin.setting('ServiceSettings.EnforceMultifactorAuthentication').trueRadio,
            ).toBeChecked();
            await settle(adminApp.admin.saveButton, {wait: Api.PatchConfig}).click();

            // the admin has no MFA either, so once enforcement is saved its API calls are refused: wait on the page
            await expect(adminApp.admin.saveButton).toBeSaved();

            // # Log in as an unenrolled user
            const app = await openLogin(pw, page);
            await logIn(app, user.username, user.password);

            // * Verify MFA setup is shown
            await expect(page).toHavePath(`${app.mfaPage.pathFor()}/setup`);
            await expect(app.mfa.titleText).toBeVisible();
            await expect(app.mfa.titleText).toHaveRole('heading');
            await expect(app.mfa.titleText).toHaveAccessibleName('Multi-factor Authentication Setup');
        } finally {
            await pw.resetConfig(adminClient);
        }
    },
);

/**
 * @objective Verify an admin can remove MFA from an enrolled user, who then logs in without it.
 *
 * @precondition
 * A licensed server.
 */
test('MM-T1781 lets an admin remove MFA from an enrolled user', {tag: '@authentication'}, async ({pw, page}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    const {restore} = await adminClient.patchConfig({
        ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
    });

    try {
        await pw.enableUserMfa(adminClient, user.id);

        // # Remove MFA from the user in System Console > Users
        const adminApp = await openSystemUsers(pw, adminUser);
        await searchSystemUsers(adminApp, user.username, user);
        // the table can re-render under an open menu as its search settles, detaching the item: reopen and retry
        await expect(async () => {
            const row = adminApp.admin.users.table.row(user.id);
            await row.actionsButton.click();
            const menu = adminApp.adminUserActionsMenu;
            await expect(menu.removeMfaMenuItem).toBeVisible();
            await settle(menu.removeMfaMenuItem, {
                wait: Api.UpdateUserMfa,
                params: {user_id: user.id},
                timeout: duration.ten_sec,
            }).click();
            await expect(menu.removeMfaMenuItem).not.toBeVisible();
        }).toPass({timeout: duration.half_min});
        await expect.poll(async () => (await adminClient.getUser(user.id)).mfa_active ?? false).toBe(false);

        // # Log in as the user
        const app = await openLogin(pw, page);
        await logIn(app, user.username, user.password);

        // * Verify login goes straight to the team-join page, without MFA
        await expectOnSelectTeam(page);
        await expect(app.mfa.titleText).toBeHidden();
        await expect(app.selectTeam.titleText).toBeVisible();
        await expect(app.selectTeam.titleText).toHaveRole('heading');
        await expect(app.selectTeam.titleText).toHaveAccessibleName('Teams you can join:');
    } finally {
        await restore();
    }
});

/**
 * @objective Verify Remove MFA isn't offered for a user who never enrolled.
 *
 * @precondition
 * A licensed server.
 */
test('MM-T1782 hides Remove MFA for a user who has not enrolled', {tag: '@authentication'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const user = await pw.createNewUserProfile(adminClient);

    const {restore} = await adminClient.patchConfig({
        ServiceSettings: {EnableMultifactorAuthentication: true, EnforceMultifactorAuthentication: false},
    });

    try {
        // # Open the user's actions in System Console > Users
        const app = await openSystemUsers(pw, adminUser);
        await searchSystemUsers(app, user.username, user);
        const row = app.admin.users.table.row(user.id);
        await row.actionsButton.click();
        const actions = app.adminUserActionsMenu;

        // * Verify Remove MFA isn't offered
        await expect(actions.deactivateMenuItem).toBeVisible();
        await expect(actions.removeMfaMenuItem).toHaveCount(0);
    } finally {
        await restore();
    }
});
