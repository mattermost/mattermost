// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

export function isProductSidebarEnabled(state: GlobalState): boolean {
    return getFeatureFlagValue(state, 'EnableProductSidebar') === 'true';
}
