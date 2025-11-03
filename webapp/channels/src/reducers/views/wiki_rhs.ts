// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiRhsTypes} from 'utils/constants';

export type WikiRhsState = {
    mode: 'outline' | 'comments';
    wikiId: string | null;
    selectedPageId: string;
    focusedInlineCommentId: string | null;
    activeTab: 'page_comments' | 'all_threads';
};

const initialState: WikiRhsState = {
    mode: 'outline',
    wikiId: null,
    selectedPageId: '',
    focusedInlineCommentId: null,
    activeTab: 'page_comments',
};

export default function wikiRhsReducer(state = initialState, action: any): WikiRhsState {
    switch (action.type) {
    case WikiRhsTypes.SET_MODE:
        return {...state, mode: action.mode};
    case WikiRhsTypes.SET_WIKI_ID:
        return {...state, wikiId: action.wikiId};
    case WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID:
        return {...state, focusedInlineCommentId: action.commentId};
    case WikiRhsTypes.SET_ACTIVE_TAB:
        return {...state, activeTab: action.tab};
    case 'UPDATE_RHS_STATE':
        if (action.state === 'wiki') {
            return {...state, selectedPageId: action.pageId || ''};
        }
        return {...state, selectedPageId: ''};
    default:
        return state;
    }
}
