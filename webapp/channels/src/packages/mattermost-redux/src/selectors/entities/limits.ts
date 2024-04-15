// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppLimits} from '@mattermost/types/limits';
import type {GlobalState} from '@mattermost/types/store';

export function getUsersLimits(state: GlobalState): AppLimits {
    return state.entities.limits.usersLimits;
}
