// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function toggleTeamSidebarExpanded() {
    return {
        type: ActionTypes.GUILDED_TOGGLE_TEAM_SIDEBAR,
    };
}

export function setTeamSidebarExpanded(expanded: boolean) {
    return {
        type: ActionTypes.GUILDED_SET_TEAM_SIDEBAR_EXPANDED,
        expanded,
    };
}

export function setDmMode(isDmMode: boolean) {
    return {
        type: ActionTypes.GUILDED_SET_DM_MODE,
        isDmMode,
    };
}

export function toggleDmMode() {
    return {
        type: ActionTypes.GUILDED_TOGGLE_DM_MODE,
    };
}

export function setRhsTab(tab: 'members' | 'threads') {
    return {
        type: ActionTypes.GUILDED_SET_RHS_TAB,
        tab,
    };
}

export type GuildedModalType = 'info' | 'pins' | 'files' | 'search' | 'edit_history';

export function openGuildedModal(modalType: GuildedModalType, data?: Record<string, unknown>) {
    return {
        type: ActionTypes.GUILDED_OPEN_MODAL,
        modalType,
        data,
    };
}

export function closeGuildedModal() {
    return {
        type: ActionTypes.GUILDED_CLOSE_MODAL,
    };
}
