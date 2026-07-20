// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {selectChannel} from 'mattermost-redux/actions/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {SidebarSize} from 'components/resizable_sidebar/constants';

import {getHistory} from 'utils/browser_history';
import Constants, {ActionTypes} from 'utils/constants';

import type {ActionFunc, ThunkActionFunc} from 'types/store';
import {LhsItemType} from 'types/store/lhs';

export const setLhsSize = (sidebarSize?: SidebarSize) => {
    let newSidebarSize = sidebarSize;
    if (!sidebarSize) {
        const width = window.innerWidth;

        switch (true) {
        case width <= Constants.SMALL_SIDEBAR_BREAKPOINT: {
            newSidebarSize = SidebarSize.SMALL;
            break;
        }
        case width > Constants.SMALL_SIDEBAR_BREAKPOINT && width <= Constants.MEDIUM_SIDEBAR_BREAKPOINT: {
            newSidebarSize = SidebarSize.MEDIUM;
            break;
        }
        case width > Constants.MEDIUM_SIDEBAR_BREAKPOINT && width <= Constants.LARGE_SIDEBAR_BREAKPOINT: {
            newSidebarSize = SidebarSize.LARGE;
            break;
        }
        default: {
            newSidebarSize = SidebarSize.XLARGE;
        }
        }
    }
    return {
        type: ActionTypes.SET_LHS_SIZE,
        size: newSidebarSize,
    };
};

export const toggle = () => ({
    type: ActionTypes.TOGGLE_LHS,
});

export const open = () => ({
    type: ActionTypes.OPEN_LHS,
});

export const close = () => ({
    type: ActionTypes.CLOSE_LHS,
});

export const selectStaticPage = (itemId: string) => ({
    type: ActionTypes.SELECT_STATIC_PAGE,
    data: itemId,
});

export const selectLhsItem = (type: LhsItemType, id?: string): ThunkActionFunc<unknown> => {
    return (dispatch) => {
        switch (type) {
        case LhsItemType.Channel:
            dispatch(selectChannel(id || ''));
            dispatch(selectStaticPage(''));
            break;
        case LhsItemType.Page:
            dispatch(selectChannel(''));
            dispatch(selectStaticPage(id || ''));
            break;
        case LhsItemType.None:
            dispatch(selectChannel(''));
            dispatch(selectStaticPage(''));
            break;
        default:
            throw new Error('Unknown LHS item type: ' + type);
        }
    };
};

export function switchToLhsStaticPage(id: string): ActionFunc<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const teamUrl = getCurrentRelativeTeamUrl(state);
        getHistory().push(`${teamUrl}/${id}`);

        return {data: true};
    };
}
