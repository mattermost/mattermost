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
    invert: boolean;

    /**
     * Content protected by the permissions gate
     */
    children: React.ReactNode;
};

export default class TeamPermissionGate extends React.PureComponent<Props> {
    public static defaultProps = {
        invert: false,
    }

    render() {
        if (this.props.hasPermission && !this.props.invert) {
            return this.props.children;
        }
        if (!this.props.hasPermission && this.props.invert) {
            return this.props.children;
        }
        return null;
    }
}
