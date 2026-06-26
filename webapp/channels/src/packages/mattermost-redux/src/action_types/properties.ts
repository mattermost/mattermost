// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({

    // Field actions
    RECEIVED_PROPERTY_FIELDS: null,
    PROPERTY_FIELD_DELETED: null,

    // Value actions
    RECEIVED_PROPERTY_VALUES: null,
    PROPERTY_VALUE_DELETED: null,
    PROPERTY_VALUES_DELETED_FOR_FIELD: null,
    PROPERTY_VALUES_DELETED_FOR_TARGET: null,

    // Group actions
    RECEIVED_PROPERTY_GROUP: null,
});
