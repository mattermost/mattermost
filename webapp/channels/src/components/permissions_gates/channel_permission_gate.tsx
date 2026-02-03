// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import Gate from './gate';

type Props = {

    /**
     * Channel to check the permission
     */
    channelId?: string;

    /**
     * Team to check the permission
     */
    teamId?: string;

    /**
     * Permissions enough to pass the gate (binary OR)
     */
    permissions: string[];

    /**
     * Invert the permission (used for else)
     */
    invert?: boolean;

    /**
     * Content protected by the permissions gate
     */
    children: React.ReactNode;
}

const ChannelPermissionGate = ({channelId, teamId, permissions, children, invert = false}: Props) => {
    const hasPermission = useSelector((state: GlobalState) => {
        if (!channelId || teamId === null || typeof teamId === 'undefined') {
            return false;
        }
        for (const permission of permissions) {
            if (haveIChannelPermission(state, teamId, channelId, permission)) {
                return true;
            }
        }
        return false;
    });

    return (
        <Gate
            invert={invert}
            hasPermission={hasPermission}
        >
            {children}
        </Gate>
    );
};

export default React.memo(ChannelPermissionGate);
