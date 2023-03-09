// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    RECEIVED_THREAD: null,
    RECEIVED_THREADS: null,
    RECEIVED_UNREAD_THREADS: null,
    FOLLOW_CHANGED_THREAD: null,
    READ_CHANGED_THREAD: null,
    ALL_TEAM_THREADS_READ: null,
    DECREMENT_THREAD_COUNTS: null,
    RECEIVED_THREAD_COUNTS: null,
});
