// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ID_PATH_PATTERN = '[a-z0-9]{26}';

const TEAM_NAME_PATH_PATTERN1 = '[a-z0-9]+[a-z\\-0-9]*[a-z0-9]+';
const TEAM_NAME_PATH_PATTERN2 = '[a-z0-9]+__[a-z0-9]+';
export const TEAM_NAME_PATH = [
    `/:team(${TEAM_NAME_PATH_PATTERN1})`,
    `/:team(${TEAM_NAME_PATH_PATTERN2})`,
];

const CHANNEL_NAME_PATH_PATTERN1 = '[a-z0-9]+[a-z\\-\\_0-9]*[a-z0-9]+';
const CHANNEL_NAME_PATH_PATTERN2 = '[a-z0-9]+__[a-z0-9]+';
const USER_NAME_PATH_PATTERN = '@[a-z0-9\\.\\-_:]+';

// From https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
const EMAIL_PATH_PATTERN = '[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+';

// This should cover:
// - Channel name
// - Channel ID
// - Group Channel Name (40 length UID)
// - DM Name (userID__userID)
// - Username prefixed by a @
// - User ID
// - Email
export const IDENTIFIER_PATH = [
    `/:identifier(${CHANNEL_NAME_PATH_PATTERN1})`,
    `/:identifier(${CHANNEL_NAME_PATH_PATTERN2})`,
    `/:identifier(${USER_NAME_PATH_PATTERN})`,
    `/:identifier(${EMAIL_PATH_PATTERN})`,
];
