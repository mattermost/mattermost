// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DispatchFunc} from 'mattermost-redux/types/actions';
import {ExtendedPost, removePost} from 'mattermost-redux/actions/posts';

import {isThreadOpen} from 'selectors/views/threads';
import {getGlobalItem} from 'selectors/storage';

import {removeDraft} from 'actions/views/drafts';
import {closeRightHandSide} from 'actions/views/rhs';

import {StoragePrefixes} from 'utils/constants';

import {GlobalState} from 'types/store';

/**
 * This action is called when the deleted post which is shown as 'deleted' in the RHS is then removed from the channel manually.
 * @param post Deleted post
 */
export function removePostCloseRHSDeleteDraft(post: ExtendedPost) {
    return (dispatch: DispatchFunc, getState: () => GlobalState) => {
        if (isThreadOpen(getState(), post.id)) {
            dispatch(closeRightHandSide());
        }

        const draftKey = `${StoragePrefixes.COMMENT_DRAFT}${post.id}`;
        if (getGlobalItem(getState(), draftKey, null)) {
            dispatch(removeDraft(draftKey, post.channel_id, post.id));
        }

        return dispatch(removePost(post));
    };
}
