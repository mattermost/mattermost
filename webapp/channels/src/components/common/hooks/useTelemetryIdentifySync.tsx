// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

/**
 * The purpose of this hook is to sync the user's id and role with client4's user id and role,
 * which is essential to identify the user in telemetry.
 */
function useTelemetryIdentitySync() {
    const user = useSelector(getCurrentUser);
    const userId = user?.id ?? '';
    const userRoles = user?.roles ?? '';

    useEffect(() => {
        if (userId) {
            Client4.setUserId(userId);
        }
        if (userRoles) {
            Client4.setUserRoles(userRoles);
        }
    }, [userId, userRoles]);

    return null;
}

export default useTelemetryIdentitySync;
