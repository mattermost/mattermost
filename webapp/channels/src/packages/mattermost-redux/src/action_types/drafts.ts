// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    GET_USER_DRAFTS: null,
    CREATE_USER_DRAFT: null,
    DELETE_USER_DRAFT: null,
    UPDATE_USER_DRAFT: null,
    UPSERT_USER_DRAFT: null,

    GET_DRAFTS_FAILURE: null,
    UPSERT_DRAFT_FAILURE: null,
    DELETE_DRAFT_FAILURE: null,
});
