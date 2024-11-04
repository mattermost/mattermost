// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {getMissingProfilesByUsernames} from 'mattermost-redux/actions/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {getPotentialMentionsForName} from 'utils/post_utils';

export function getMissingMentionedUsers(text: string): ActionFuncAsync<Array<UserProfile['username']>> {
    return getMissingProfilesByUsernames(getPotentialMentionsForName(text));
}
