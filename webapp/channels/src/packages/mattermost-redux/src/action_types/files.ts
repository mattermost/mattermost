// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';
export default keyMirror({
    FILE_UPLOAD_STARTED: null,
    FILE_UPLOAD_COMPLETED: null,
    FILE_UPLOAD_FAILED: null,
    FILE_UPLOAD_REMOVED: null,

    RECEIVED_FILES_FOR_SEARCH: null,
    RECEIVED_FILES_FOR_POST: null,
    RECEIVED_UPLOAD_FILES: null,
    RECEIVED_FILE_PUBLIC_LINK: null,
});
