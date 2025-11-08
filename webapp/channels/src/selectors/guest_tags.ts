// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

/**
 * Selector to determine if guest tags should be hidden based on server configuration.
 * This is memoized to prevent unnecessary re-computations on unrelated state changes.
 *
 * @param state - The Redux global state
 * @returns true if guest tags should be hidden, false otherwise
 */
export const shouldHideGuestTags = createSelector(
    'shouldHideGuestTags',
    getConfig,
    (config) => {
        // Safely check config value - defaults to false (show tags) if config is undefined
        return config?.HideGuestTags === 'true';
    },
);
