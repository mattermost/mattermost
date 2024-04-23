// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerLimits} from '@mattermost/types/limits';
import type {GlobalState} from '@mattermost/types/store';

export function getServerLimits(state: GlobalState): ServerLimits {
    return state.entities.limits.serverLimits;
}
