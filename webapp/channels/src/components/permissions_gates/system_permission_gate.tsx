// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import Gate from './gate';

type Props = {
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

const SystemPermissionGate = ({
    invert = false,
    permissions,
    children,
}: Props) => {
    const hasPermission = useSelector((state: GlobalState) => {
        for (const permission of permissions) {
            if (haveISystemPermission(state, {permission})) {
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

export default React.memo(SystemPermissionGate);
