// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';

export function getDisplayableErrors(state: GlobalState) {
    return state.errors.filter((error) => error.displayable);
}
