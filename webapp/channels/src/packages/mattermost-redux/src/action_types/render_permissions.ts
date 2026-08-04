// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    RECEIVED_RENDER_DECISIONS: null,
    INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL: null,
    INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER: null,
    CLEAR_RENDER_DECISIONS: null,
    MARK_CHANNEL_POSTS_STALE_FOR_REDACTION: null,
    CONSUME_CHANNEL_POSTS_STALE_FOR_REDACTION: null,
});
