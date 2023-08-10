// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import SystemPermissionGate from './system_permission_gate';

import type {GlobalState} from 'types/store';

type Props = {
    permissions: string[];
}
function mapStateToProps(state: GlobalState, ownProps: Props) {
    for (const permission of ownProps.permissions) {
        if (haveISystemPermission(state, {permission})) {
            return {hasPermission: true};
        }
    }

    return {hasPermission: false};
}

export default connect(mapStateToProps)(SystemPermissionGate);
