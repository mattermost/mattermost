// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {removePost} from 'mattermost-redux/actions/posts';
import type {ExtendedPost} from 'mattermost-redux/actions/posts';

import {removeDraft} from 'actions/views/drafts';
import {closeRightHandSide} from 'actions/views/rhs';
import {getGlobalItem} from 'selectors/storage';
import {isThreadOpen} from 'selectors/views/threads';

import {StoragePrefixes} from 'utils/constants';

import type {ActionFunc} from 'types/store';

/**
 * This action is called when the deleted post which is shown as 'deleted' in the RHS is then removed from the channel manually.
 * @param post Deleted post
 */
export function removePostCloseRHSDeleteDraft(post: ExtendedPost): ActionFunc<boolean> {
    return (dispatch, getState) => {
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
