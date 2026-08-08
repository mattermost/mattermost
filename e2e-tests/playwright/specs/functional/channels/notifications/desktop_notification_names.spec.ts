// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {displayNameCases, runDisplayNameCase} from './desktop_notification_support';

/**
 * @objective Verify nickname display preference falls back to first and last name when no nickname exists.
 */
test(
    'MM-T489_2 Desktop Notifications display teammate full name when nickname does not exist',
    {tag: '@notifications'},
    async ({pw}) => {
        // # Configure nickname display and post a mention from a sender without a nickname
        // * Verify the desktop notification falls back to the sender's first and last name
        await runDisplayNameCase(pw, displayNameCases.nicknameFallback);
    },
);

/**
 * @objective Verify full-name display preference formats the sender name in desktop notifications.
 */
test(
    'MM-T490 Desktop Notifications with teammate name display set to first and last name',
    {tag: '@notifications'},
    async ({pw}) => {
        // # Configure full-name display and post a mention from another user
        // * Verify the desktop notification displays the sender's first and last name
        await runDisplayNameCase(pw, displayNameCases.fullName);
    },
);
