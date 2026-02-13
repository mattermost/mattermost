// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes, WikiRhsTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {InlineAnchor} from 'types/store/pages';

export type WikiRhsState = {
    mode: 'outline' | 'comments';
    wikiId: string | null;
    selectedPageId: string;
    focusedInlineCommentId: string | null;
    activeTab: 'page_comments' | 'all_threads';
    pendingInlineAnchor: InlineAnchor | null;
    isSubmittingComment: boolean;
};

const initialState: WikiRhsState = {
    mode: 'outline',
    wikiId: null,
    selectedPageId: '',
    focusedInlineCommentId: null,
    activeTab: 'page_comments',
    pendingInlineAnchor: null,
    isSubmittingComment: false,
};

export default function wikiRhsReducer(state = initialState, action: MMAction): WikiRhsState {
    switch (action.type) {
    case WikiRhsTypes.SET_MODE:
        return {...state, mode: action.mode};
    case WikiRhsTypes.SET_WIKI_ID:
        return {...state, wikiId: action.wikiId};
    case WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID:
        return {...state, focusedInlineCommentId: action.commentId};
    case WikiRhsTypes.SET_ACTIVE_TAB:
        return {...state, activeTab: action.tab};
    case WikiRhsTypes.SET_PENDING_INLINE_ANCHOR:
        return {...state, pendingInlineAnchor: action.anchor};
    case WikiRhsTypes.SET_SUBMITTING_COMMENT:
        return {...state, isSubmittingComment: action.isSubmitting};
    case ActionTypes.UPDATE_RHS_STATE:
        if (action.state === 'wiki') {
            return {...state, selectedPageId: action.pageId || ''};
        }
        return {...state, selectedPageId: ''};
    case UserTypes.LOGOUT_SUCCESS:
        return initialState;
    default:
        return state;
    }
}
