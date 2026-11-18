// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DefaultChannel, expect, test} from '@mattermost/playwright-lib';

import {logIn, openLogin} from './support';

/**
 * @objective Verify a valid email and password logs in and lands on a team channel.
 */
test('logs in with email and password and lands on a channel', {tag: '@authentication'}, async ({pw, page}) => {
    const {user, team} = await pw.initSetup();

    // # Log in with the user's email
    const app = await openLogin(pw, page);
    await logIn(app, user.email, user.password);

    // * Verify login itself lands on a real channel
    await expect(page).toHavePath(app.channelsPage.pathFor({team, channel: DefaultChannel.TownSquare}));
    await expect(app.center.postCreate.message.container).toBeVisible();
});

/**
 * @objective Verify a valid username and password logs in and lands on a team channel.
 */
test('logs in with username and password and lands on a channel', {tag: '@authentication'}, async ({pw, page}) => {
    const {user, team} = await pw.initSetup();

    // # Log in with the user's username
    const app = await openLogin(pw, page);
    await logIn(app, user.username, user.password);

    // * Verify login itself lands on a real channel
    await expect(page).toHavePath(app.channelsPage.pathFor({team, channel: DefaultChannel.TownSquare}));
    await expect(app.center.postCreate.message.container).toBeVisible();
});

/**
 * @objective Verify invalid credentials show an error and do not create a session.
 */
test('rejects invalid credentials with a generic error', {tag: '@authentication'}, async ({pw, page}) => {
    const {user} = await pw.initSetup();

    // # Submit the correct username with the wrong password
    const app = await openLogin(pw, page);
    await logIn(app, user.username, 'WrongPassword1', {status: 401});

    // * Verify the login is rejected without revealing which field is wrong
    await expect(app.login.banner).toBeVisible();
    await expect(app.login.banner).toContainText(
        /The email\/username or password is invalid\.|Enter a valid email or username and\/or password/,
    );
    await expect(page).toHavePath(app.loginPage.pathFor());
});
