// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

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
     * Has permission
     */
    hasPermission: boolean;

    /**
     * Invert the permission (used for else)
     */
    invert?: boolean;

    /**
     * Content protected by the permissions gate
     */
    children: React.ReactNode;
};

const TeamPermissionGate = ({invert = false, hasPermission, children}: Props) => {
    if (hasPermission !== invert) {
        return <>{children}</>;
    }
    return null;
};

export default React.memo(TeamPermissionGate);
