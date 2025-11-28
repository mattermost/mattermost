// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

/**
 * Returns true if guest tags should be hidden based on server configuration.
 */
export const shouldHideGuestTags = createSelector(
    'shouldHideGuestTags',
    getConfig,
    (config) => config?.HideGuestTags === 'true',
);
