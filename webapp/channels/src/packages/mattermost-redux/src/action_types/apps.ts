// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    RECEIVED_APP_BINDINGS: null,
    FAILED_TO_FETCH_APP_BINDINGS: null,
    RECEIVED_APP_RHS_BINDINGS: null,
    RECEIVED_APP_COMMAND_FORM: null,
    RECEIVED_APP_RHS_COMMAND_FORM: null,
    APPS_PLUGIN_ENABLED: null,
    APPS_PLUGIN_DISABLED: null,
});
