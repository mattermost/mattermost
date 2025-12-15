// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import {selectPost} from 'actions/views/rhs';
import {getSelectedPostId} from 'selectors/rhs';

import {usePost} from 'components/common/hooks/usePost';
import LoadingScreen from 'components/loading_screen';
import PostEditHistory from 'components/post_edit_history/';

export default function PostEditHistoryPopout() {
    const dispatch = useDispatch();
    const {postId} = useParams<{postId: string}>();
    const post = usePost(postId || '');
    const selectedPostId = useSelector(getSelectedPostId);

    useEffect(() => {
        if (post) {
            dispatch(selectPost(post));
        }
    }, [post, dispatch]);

    if (!selectedPostId) {
        return <LoadingScreen/>;
    }

    return (
        <PostEditHistory/>
    );
}
