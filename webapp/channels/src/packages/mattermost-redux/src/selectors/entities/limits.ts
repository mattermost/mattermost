// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerLimits} from '@mattermost/types/limits';
import type {GlobalState} from '@mattermost/types/store';

export function getServerLimits(state: GlobalState): ServerLimits {
    return state.entities.limits.serverLimits;
}

// Add new selectors for post history limits
export function getPostHistoryLimit(state: GlobalState): number {
    const limits = getServerLimits(state);
    return limits?.postHistoryLimit ?? 0;
}

export function hasPostHistoryLimit(state: GlobalState): boolean {
    const limits = getServerLimits(state);
    return (limits?.postHistoryLimit ?? 0) > 0;
}

export function shouldShowPostHistoryLimits(state: GlobalState): boolean {
    return getPostHistoryLimit(state) > 0;
}
