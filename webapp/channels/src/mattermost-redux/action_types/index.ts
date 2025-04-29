// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export const ActionTypes = keyMirror({
    GET_SHARED_CHANNELS: null,
    RECEIVED_SHARED_CHANNELS_WITH_REMOTES: null,
});
