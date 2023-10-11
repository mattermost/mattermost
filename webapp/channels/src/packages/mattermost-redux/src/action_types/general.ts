// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    RECEIVED_SERVER_VERSION: null,

    CLIENT_CONFIG_RECEIVED: null,
    CLIENT_CONFIG_RESET: null,

    CLIENT_LICENSE_RECEIVED: null,
    CLIENT_LICENSE_RESET: null,

    RECEIVED_DATA_RETENTION_POLICY: null,

    LOG_CLIENT_ERROR_REQUEST: null,
    LOG_CLIENT_ERROR_SUCCESS: null,
    LOG_CLIENT_ERROR_FAILURE: null,

    WEBSOCKET_REQUEST: null,
    WEBSOCKET_SUCCESS: null,
    WEBSOCKET_FAILURE: null,
    WEBSOCKET_CLOSED: null,
    SET_CONNECTION_ID: null,

    REDIRECT_LOCATION_SUCCESS: null,
    REDIRECT_LOCATION_FAILURE: null,
    SET_CONFIG_AND_LICENSE: null,

    WARN_METRICS_STATUS_RECEIVED: null,
    WARN_METRIC_STATUS_RECEIVED: null,
    WARN_METRIC_STATUS_REMOVED: null,

    FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED: null,
    FIRST_ADMIN_COMPLETE_SETUP_RECEIVED: null,
    SHOW_LAUNCHING_WORKSPACE: null,
});
