// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

// Team sidebar expanded state
function isTeamSidebarExpanded(state = false, action: MMAction): boolean {
    switch (action.type) {
    case ActionTypes.GUILDED_TOGGLE_TEAM_SIDEBAR:
        return !state;
    case ActionTypes.GUILDED_SET_TEAM_SIDEBAR_EXPANDED:
        return action.expanded;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

// DM mode (showing DM list instead of channels)
function isDmMode(state = false, action: MMAction): boolean {
    switch (action.type) {
    case ActionTypes.GUILDED_SET_DM_MODE:
        return action.isDmMode;
    case ActionTypes.GUILDED_TOGGLE_DM_MODE:
        return !state;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

// RHS active tab
function rhsActiveTab(state: 'members' | 'threads' = 'members', action: MMAction): 'members' | 'threads' {
    switch (action.type) {
    case ActionTypes.GUILDED_SET_RHS_TAB:
        return action.tab;
    case UserTypes.LOGOUT_SUCCESS:
        return 'members';
    default:
        return state;
    }
}

// Active modal
type ModalType = 'info' | 'pins' | 'files' | 'search' | 'edit_history' | null;

function activeModal(state: ModalType = null, action: MMAction): ModalType {
    switch (action.type) {
    case ActionTypes.GUILDED_OPEN_MODAL:
        return action.modalType;
    case ActionTypes.GUILDED_CLOSE_MODAL:
        return null;
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

// Modal data (e.g., channel ID for channel info modal)
function modalData(state: Record<string, unknown> = {}, action: MMAction): Record<string, unknown> {
    switch (action.type) {
    case ActionTypes.GUILDED_OPEN_MODAL:
        return action.data || {};
    case ActionTypes.GUILDED_CLOSE_MODAL:
        return {};
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    isTeamSidebarExpanded,
    isDmMode,
    rhsActiveTab,
    activeModal,
    modalData,
});
