// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    RECEIVED_AGENTS: null,
    AGENTS_REQUEST: null,
    AGENTS_FAILURE: null,

    RECEIVED_AGENTS_STATUS: null,
    AGENTS_STATUS_REQUEST: null,
    AGENTS_STATUS_FAILURE: null,

    RECEIVED_LLM_SERVICES: null,
    LLM_SERVICES_REQUEST: null,
    LLM_SERVICES_FAILURE: null,
});
