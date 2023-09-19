// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';

export function getCurrentUserLocale(state: GlobalState, defaultLocale = General.DEFAULT_LOCALE) {
    const currentUser = getCurrentUser(state);

    if (!currentUser) {
        return defaultLocale;
    }

    return currentUser.locale || defaultLocale;
}
