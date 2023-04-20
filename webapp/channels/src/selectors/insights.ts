// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'types/store';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {getIsMobileView} from 'selectors/views/browser';

export function showInsightsPulsatingDot(state: GlobalState): boolean {
    if (getIsMobileView(state)) {
        return false;
    }
    const insightsTutorialState = get(state, Preferences.CATEGORY_INSIGHTS, Preferences.NAME_INSIGHTS_TUTORIAL_STATE, false);
    const modalAlreadyViewed = insightsTutorialState && JSON.parse(insightsTutorialState)[Preferences.INSIGHTS_VIEWED];
    return !modalAlreadyViewed;
}
