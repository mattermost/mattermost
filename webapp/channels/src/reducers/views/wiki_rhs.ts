// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiRhsTypes} from 'utils/constants';

export type WikiRhsState = {
    mode: 'outline' | 'comments';
    wikiId: string | null;
    selectedPageId: string;
};

const initialState: WikiRhsState = {
    mode: 'outline',
    wikiId: null,
    selectedPageId: '',
};

export default function wikiRhsReducer(state = initialState, action: any): WikiRhsState {
    switch (action.type) {
    case WikiRhsTypes.SET_MODE:
        return {...state, mode: action.mode};
    case WikiRhsTypes.SET_WIKI_ID:
        return {...state, wikiId: action.wikiId};
    case 'UPDATE_RHS_STATE':
        if (action.state === 'wiki') {
            return {...state, selectedPageId: action.pageId || ''};
        }
        return {...state, selectedPageId: ''};
    default:
        return state;
    }
}
