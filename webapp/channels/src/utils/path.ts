// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const ID_PATH_PATTERN = '[a-z0-9]{26}';

// This should cover:
// - Team name (lowercase english characters, numbers or -)
// - Two ids separated by __ (userID__userID)
export const TEAM_NAME_PATH_PATTERN = '[a-z0-9\\-_]+';

// This should cover:
// - Channel name
// - Channel ID
// - Group Channel Name (40 length UID)
// - DM Name (userID__userID)
// - Username prefixed by a @
// - Username prefixed by a @, with colon and remote name e.g. @username:companyname
// - User ID
// - Email
export const IDENTIFIER_PATH_PATTERN = '[@a-zA-Z\\-_0-9][@a-zA-Z\\-_0-9.:]*';
