// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export function getShouldFocusRHS(state: GlobalState): boolean {
    return state.views.rhs.shouldFocusRHS;
}
