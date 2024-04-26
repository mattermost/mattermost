// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import Gate from './gate';

export type Props = {

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

const AnyTeamPermissionGate = ({permissions, children, invert = false}: Props) => {
    const hasPermission = useSelector((state: GlobalState) => {
        const teams = getMyTeams(state);
        for (const team of teams) {
            for (const permission of permissions) {
                if (haveITeamPermission(state, team.id, permission)) {
                    return true;
                }
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

export default React.memo(AnyTeamPermissionGate);
