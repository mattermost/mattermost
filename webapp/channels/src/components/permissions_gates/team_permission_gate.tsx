// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import type {GlobalState} from 'types/store';

import Gate from './gate';

type Props = {

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
};

const TeamPermissionGate = ({
    teamId,
    permissions,
    invert = false,
    children,
}: Props) => {
    const hasPermission = useSelector((state: GlobalState) => {
        if (!teamId) {
            return false;
        }

        for (const permission of permissions) {
            if (haveITeamPermission(state, teamId, permission)) {
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

export default React.memo(TeamPermissionGate);
