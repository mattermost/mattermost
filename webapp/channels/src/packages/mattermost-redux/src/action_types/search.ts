// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    SEARCH_POSTS_REQUEST: null,
    SEARCH_POSTS_SUCCESS: null,

    SEARCH_FILES_REQUEST: null,
    SEARCH_FILES_SUCCESS: null,

    SEARCH_FLAGGED_POSTS_REQUEST: null,
    SEARCH_FLAGGED_POSTS_SUCCESS: null,
    SEARCH_FLAGGED_POSTS_FAILURE: null,

    SEARCH_PINNED_POSTS_REQUEST: null,
    SEARCH_PINNED_POSTS_SUCCESS: null,
    SEARCH_PINNED_POSTS_FAILURE: null,
    REMOVE_SEARCH_PINNED_POSTS: null,
    RECEIVED_SEARCH_POSTS: null,
    RECEIVED_SEARCH_FILES: null,
    RECEIVED_SEARCH_FLAGGED_POSTS: null,
    RECEIVED_SEARCH_PINNED_POSTS: null,
    RECEIVED_SEARCH_TERM: null,
    REMOVE_SEARCH_POSTS: null,
    REMOVE_SEARCH_FILES: null,
    REMOVE_SEARCH_TERM: null,
});
