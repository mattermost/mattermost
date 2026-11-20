// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The login of every user this run created or logged in as, by user id, so a client can act as another user
 * the test knows (`createPost({user_id})`, see PlaywrightClient4). Module state, so it is per Playwright worker.
 */
const known = new Map<string, {username: string; password: string}>();

export function rememberLogin(user: {id: string; username: string}, password: string) {
    known.set(user.id, {username: user.username, password});
}

export function loginOf(userId: string) {
    return known.get(userId);
}
