// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SearchTypes} from 'utils/constants';

export function setModalSearchTerm(term) {
    return {
        type: SearchTypes.SET_MODAL_SEARCH,
        data: term,
    };
}

export function setPopoverSearchTerm(term) {
    return {
        type: SearchTypes.SET_POPOVER_SEARCH,
        data: term,
    };
}

export function setChannelMembersRhsSearchTerm(term) {
    return {
        type: SearchTypes.SET_CHANNEL_MEMBERS_RHS_SEARCH,
        data: term,
    };
}

export function setModalFilters(filters = {}) {
    return {
        type: SearchTypes.SET_MODAL_FILTERS,
        data: filters,
    };
}

export function setUserGridSearch(term) {
    return {
        type: SearchTypes.SET_USER_GRID_SEARCH,
        data: term,
    };
}

export function setUserGridFilters(filters = {}) {
    return {
        type: SearchTypes.SET_USER_GRID_FILTERS,
        data: filters,
    };
}

export function setTeamListSearch(term) {
    return {
        type: SearchTypes.SET_TEAM_LIST_SEARCH,
        data: term,
    };
}

export function setChannelListSearch(term) {
    return {
        type: SearchTypes.SET_CHANNEL_LIST_SEARCH,
        data: term,
    };
}

export function setChannelListFilters(filters = {}) {
    return {
        type: SearchTypes.SET_CHANNEL_LIST_FILTERS,
        data: filters,
    };
}
