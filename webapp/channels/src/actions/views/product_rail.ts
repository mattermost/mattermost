// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PreferenceType} from '@mattermost/types/preferences';

import {PreferenceTypes} from 'mattermost-redux/action_types';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

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
// names the preference may hold for the item: a product's bare plugin id, which earlier builds
// saved and which also names the plugin's other products (aliasPeers). An alias is replaced by
// those peers' own ids, so they keep their state.
export function setProductRailItemHidden(itemId: string, hidden: boolean, aliases: string[] = [], aliasPeers: string[] = []): ActionFuncAsync {
    return (dispatch, getState) => {
        const current = getProductRailHiddenItems(getState());
        const peersHiddenByAlias = aliases.some((alias) => current.includes(alias)) ? aliasPeers.filter((id) => !current.includes(id)) : [];
        const others = [...current, ...peersHiddenByAlias].filter((id) => id !== itemId && !aliases.includes(id));
        return dispatch(saveRailListPreference(Preferences.PRODUCT_RAIL_HIDDEN_ITEMS, JSON.stringify(hidden ? [...others, itemId] : others)));
    };
}

// Saves the order the user has put the rail items in.
export function setProductRailOrder(order: string[]): ActionFuncAsync {
    return (dispatch) => dispatch(saveRailListPreference(Preferences.PRODUCT_RAIL_ORDER, JSON.stringify(order)));
}

// Each rail list preference's save in flight, and the value the server last accepted (undefined
// for none saved), from before the first save still in flight.
const pendingSaves = new Map<string, Promise<void>>();
const acceptedValues = new Map<string, PreferenceType | undefined>();

/**
 * Saves one of the rail's list preferences (the unpinned items, or the order). Each save holds the
 * whole list, built on the one before, so unlike savePreferences:
 * - saves go to the server one after another, so an older list can't land after a newer one; and
 * - a failed save puts back the last list the server accepted, rather than deleting the
 *   preference (which would pin, or reorder, everything), unless a newer change has since been
 *   made, which its own save then settles.
 */
export function saveRailListPreference(name: string, value: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const userId = getCurrentUserId(state);
        const category = Preferences.CATEGORY_SIDEBAR_SETTINGS;
        const key = getPreferenceKey(category, name);
        const preference: PreferenceType = {category, name, user_id: userId, value};

        if (!pendingSaves.has(name)) {
            acceptedValues.set(name, state.entities.preferences.myPreferences[key]);
        }

        // The list shows straight away; the server catches up.
        dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [preference]});

        const previousSave = pendingSaves.get(name) ?? Promise.resolve();
        const save = previousSave.then(async () => {
            try {
                await Client4.savePreferences(userId, [preference]);
                acceptedValues.set(name, preference);
            } catch {
                if (getState().entities.preferences.myPreferences[key]?.value !== value) {
                    return;
                }
                const accepted = acceptedValues.get(name);
                if (accepted) {
                    dispatch({type: PreferenceTypes.RECEIVED_PREFERENCES, data: [accepted]});
                } else {
                    dispatch({type: PreferenceTypes.DELETED_PREFERENCES, data: [preference]});
                }
            }
        });
        pendingSaves.set(name, save);
        save.then(() => {
            if (pendingSaves.get(name) === save) {
                pendingSaves.delete(name);
            }
        });

        return {data: true};
    };
}
