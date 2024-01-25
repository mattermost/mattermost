// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UsersLimits} from '@mattermost/types/limits';
import type {GlobalState} from '@mattermost/types/store';

export function getUsersLimits(state: GlobalState): UsersLimits {
    return state.entities.limits.usersLimits;
}
