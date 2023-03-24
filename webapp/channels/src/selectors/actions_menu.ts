// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'types/store';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {getIsMobileView} from 'selectors/views/browser';

export function showActionsDropdownPulsatingDot(state: GlobalState): boolean {
    if (getIsMobileView(state)) {
        return false;
    }
    const actionsMenuTutorialState = get(state, Preferences.CATEGORY_ACTIONS_MENU, Preferences.NAME_ACTIONS_MENU_TUTORIAL_STATE, false);
    const modalAlreadyViewed = actionsMenuTutorialState && JSON.parse(actionsMenuTutorialState)[Preferences.ACTIONS_MENU_VIEWED];
    return !modalAlreadyViewed;
}
