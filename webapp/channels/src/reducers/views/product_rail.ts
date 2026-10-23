// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {ProductRailSection} from 'types/store/views';

function section(state: ProductRailSection = 'home', action: MMAction): ProductRailSection {
    switch (action.type) {
    case ActionTypes.SET_PRODUCT_RAIL_SECTION:
        return action.data.section;
    case ActionTypes.PRODUCT_RAIL_PATH_VIEWED:
        return action.data.section ?? state;
    default:
        return state;
    }
}

type LastPaths = Record<string, Record<string, string>>;

function lastPathByTeam(state: LastPaths = {}, action: MMAction): LastPaths {
    switch (action.type) {
    case ActionTypes.PRODUCT_RAIL_PATH_VIEWED: {
        const {tab, teamId, path} = action.data;

        // A channel can be filed under Channels before its plugin says it's a board (or the
        // reverse), so viewing it in one section takes it out of the other.
        const otherSections: Record<string, string> = {channels: 'boards', boards: 'channels'};
        const otherSection = otherSections[tab];
        const misfiled = otherSection !== undefined && state[otherSection]?.[teamId] === path;

        if (state[tab]?.[teamId] === path && !misfiled) {
            return state;
        }

        const nextState: LastPaths = {
            ...state,
            [tab]: {
                ...state[tab],
                [teamId]: path,
            },
        };
        if (misfiled) {
            const otherPaths = {...state[otherSection]};
            delete otherPaths[teamId];
            nextState[otherSection] = otherPaths;
        }
        return nextState;
    }
    case ActionTypes.PRODUCT_RAIL_PATHS_LOADED: {
        // Saved paths fill in around what's been viewed since the page loaded, which is newer.
        const loaded: LastPaths = action.data;
        const merged: LastPaths = {...state};
        for (const [tab, paths] of Object.entries(loaded)) {
            merged[tab] = {...paths, ...state[tab]};
        }
        return merged;
    }
    default:
        return state;
    }
}

// Whether the paths saved from earlier sessions have been restored, before which saving the
// current ones would overwrite them.
function lastPathsLoaded(state = false, action: MMAction): boolean {
    switch (action.type) {
    case ActionTypes.PRODUCT_RAIL_PATHS_LOADED:
        return true;
    default:
        return state;
    }
}

export default combineReducers({
    section,
    lastPathByTeam,
    lastPathsLoaded,
});
