// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a valid email and password logs in and lands on a team channel.
 */
test('logs in with email and password and lands on a channel', {tag: '@authentication'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in with the user's email
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.login(user, false);

    // * Verify login itself lands on a real channel
    await pw.channelsPage.expectOnTeamChannel(team.name);
});

/**
 * @objective Verify a valid username and password logs in and lands on a team channel.
 */
test('logs in with username and password and lands on a channel', {tag: '@authentication'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in with the user's username
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.login(user, true);

    // * Verify login itself lands on a real channel
    await pw.channelsPage.expectOnTeamChannel(team.name);
});

/**
 * @objective Verify invalid credentials show an error and do not create a session.
 */
test('rejects invalid credentials with a generic error', {tag: '@authentication'}, async ({pw}) => {
    const {user} = await pw.initSetup();

    // # Submit the correct username with the wrong password
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await pw.loginPage.submitCredentials(user.username, 'WrongPassword1');

    // * Verify the login is rejected without revealing which field is wrong
    await expect(pw.loginPage.invalidCredentialsError).toBeVisible();
    await pw.loginPage.expectOnLoginPage();
});
