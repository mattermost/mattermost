// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import AdminCloudEffects from './admin_cloud_effects';

export default function CloudEffectsWrapper() {
    const isCloud = useSelector(isCurrentLicenseCloud);

    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    if (!isCloud || !isAdmin) {
        return null;
    }

    // This render can become more complex if need be, rendering multiple
    // effect components according to conditions.
    return <AdminCloudEffects/>;
}
