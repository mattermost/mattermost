// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getBool as getBoolPreference} from 'mattermost-redux/selectors/entities/preferences';

import {GlobalState} from 'types/store';
import {Preferences} from 'utils/constants';

export const arePreviewsCollapsed = (state: GlobalState) => {
    return getBoolPreference(
        state,
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.COLLAPSE_DISPLAY,
        Preferences.COLLAPSE_DISPLAY_DEFAULT !== 'false',
    );
};
