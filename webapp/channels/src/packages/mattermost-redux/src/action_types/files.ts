// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';
export default keyMirror({

    UPLOAD_FILES_REQUEST: null,
    UPLOAD_FILES_SUCCESS: null,
    UPLOAD_FILES_FAILURE: null,
    UPLOAD_FILES_CANCEL: null,

    RECEIVED_FILES_FOR_SEARCH: null,
    RECEIVED_FILES_FOR_POST: null,
    RECEIVED_UPLOAD_FILES: null,
    RECEIVED_FILE_PUBLIC_LINK: null,
    RECEIVED_FILE_PREVIEWS: null,

    START_UPLOADING_FILE: null,
    UPDATE_FILE_UPLOAD_PROGRESS: null,
    REMOVE_FILE_PREVIEWS: null,
});
