// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Constants from 'utils/constants';
import {latinise} from 'utils/latinise';

/**
 * Derives a suggested username from a display name, e.g. "My Build Bot!" -> "my-build-bot".
 * The result only contains lowercase letters, numbers, ".", "-" and "_", starts with a letter,
 * doesn't end with a symbol, and is no longer than the maximum username length. Returns an empty
 * string when no valid username can be derived, e.g. when it would be too short or reserved.
 */
export function usernameFromDisplayName(displayName: string): string {
    let username = latinise(displayName).toLowerCase().trim();
    username = username.replace(/\s+/g, '-');
    username = username.replace(/[^a-z0-9.\-_]/g, '');
    username = username.replace(/([.\-_])[.\-_]+/g, '$1');
    username = username.replace(/^[^a-z]+/, '');
    username = username.slice(0, Constants.MAX_USERNAME_LENGTH);
    username = username.replace(/[.\-_]+$/, '');

    if (username.length < Constants.MIN_USERNAME_LENGTH || Constants.RESERVED_USERNAMES.includes(username)) {
        return '';
    }

    return username;
}
