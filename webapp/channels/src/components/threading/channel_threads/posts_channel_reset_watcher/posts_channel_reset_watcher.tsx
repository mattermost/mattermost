// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {resetReloadPostsInChannel} from 'mattermost-redux/actions/posts';

const PostsChannelResetWatcher = () => {
    const dispatch = useDispatch();
    const isCRTEnabled = useSelector(isCollapsedThreadsEnabled);
    const loaded = useRef(false);
    useEffect(() => {
        if (loaded.current) {
            dispatch(resetReloadPostsInChannel());
        } else {
            loaded.current = true;
        }
    }, [isCRTEnabled]);
    return null;
};

export default PostsChannelResetWatcher;
