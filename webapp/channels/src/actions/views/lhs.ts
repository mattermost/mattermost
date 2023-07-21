// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {selectChannel} from 'mattermost-redux/actions/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';
import {LhsItemType} from 'types/store/lhs';
import {getHistory} from 'utils/browser_history';
import {ActionTypes} from 'utils/constants';

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

export const selectLhsItem = (type: LhsItemType, id?: string) => {
    return (dispatch: DispatchFunc) => {
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

export function switchToLhsStaticPage(id: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const teamUrl = getCurrentRelativeTeamUrl(state);
        getHistory().push(`${teamUrl}/${id}`);

        return {data: true};
    };
}
