// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getBool as getBoolPreference} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

export const arePreviewsCollapsed = (state: GlobalState) => {
    return getBoolPreference(
        state,
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.COLLAPSE_DISPLAY,
        Preferences.COLLAPSE_DISPLAY_DEFAULT !== 'false',
    );
};

export const isSendOnCtrlEnter = (state: GlobalState) => {
    return getBoolPreference(
        state,
        Preferences.CATEGORY_ADVANCED_SETTINGS,
        'send_on_ctrl_enter',
        false,
    );
};

export const isUseMilitaryTime = (state: GlobalState) => {
    return getBoolPreference(
        state,
        Preferences.CATEGORY_DISPLAY_SETTINGS,
        Preferences.USE_MILITARY_TIME,
        false,
    );
};
