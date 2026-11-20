// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getProductRailHiddenItems} from 'selectors/views/product_rail';

import {ActionTypes, Preferences} from 'utils/constants';

import type {ActionFuncAsync} from 'types/store';
import type {ProductRailSection, ProductRailTab} from 'types/store/views';

export function setProductRailSection(section: ProductRailSection) {
    return {
        type: ActionTypes.SET_PRODUCT_RAIL_SECTION,
        data: {section},
    };
}

// Records that the user is viewing `path` under the rail item `tab` in `teamId`, so clicking the
// item later returns to it. `section` also moves the channel sidebar to a channel's section.
export function productRailPathViewed(tab: ProductRailTab, teamId: string, path: string, section?: ProductRailSection) {
    return {
        type: ActionTypes.PRODUCT_RAIL_PATH_VIEWED,
        data: {tab, teamId, path, section},
    };
}

// Restores the paths saved from earlier sessions.
export function productRailPathsLoaded(lastPathByTeam: Record<string, Record<string, string>>) {
    return {
        type: ActionTypes.PRODUCT_RAIL_PATHS_LOADED,
        data: lastPathByTeam,
    };
}

// Hides the team sidebar, folding the teams into the product rail's team menu, or brings it back.
export function setTeamSidebarHidden(hidden: boolean): ActionFuncAsync {
    return (dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        return dispatch(savePreferences(userId, [{
            category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.HIDE_TEAM_SIDEBAR,
            user_id: userId,
            value: String(hidden),
        }]));
    };
}

// Lists boards in the Channels view as well, or leaves them to Boards alone.
export function setBoardsShownInChannels(shown: boolean): ActionFuncAsync {
    return (dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        return dispatch(savePreferences(userId, [{
            category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.SHOW_BOARDS_IN_CHANNELS,
            user_id: userId,
            value: String(shown),
        }]));
    };
}

// Unpins a rail item into the rail's More menu, or pins it back on the rail. Aliases are other
// names the preference may hold for the item, which go along with it.
export function setProductRailItemHidden(itemId: string, hidden: boolean, aliases: string[] = []): ActionFuncAsync {
    return (dispatch, getState) => {
        const state = getState();
        const userId = getCurrentUserId(state);
        const others = getProductRailHiddenItems(state).filter((id) => id !== itemId && !aliases.includes(id));
        return dispatch(savePreferences(userId, [{
            category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.PRODUCT_RAIL_HIDDEN_ITEMS,
            user_id: userId,
            value: JSON.stringify(hidden ? [...others, itemId] : others),
        }]));
    };
}

// Saves the order the user has put the rail items in.
export function setProductRailOrder(order: string[]): ActionFuncAsync {
    return (dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        return dispatch(savePreferences(userId, [{
            category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.PRODUCT_RAIL_ORDER,
            user_id: userId,
            value: JSON.stringify(order),
        }]));
    };
}
