// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {

    /**
     * Channel to check the permission
     */
    channelId?: string;

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
}

const ChannelPermissionGate = ({hasPermission, children, invert = false}: Props) => {
    if (hasPermission !== invert) {
        return <>{children}</>;
    }
    return null;
};

export default React.memo(ChannelPermissionGate);
