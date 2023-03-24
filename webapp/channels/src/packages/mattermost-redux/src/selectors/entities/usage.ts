// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CloudUsage} from '@mattermost/types/cloud';
import {GlobalState} from '@mattermost/types/store';

export function getUsage(state: GlobalState): CloudUsage {
    return state.entities.usage;
}
