// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import Permissions from 'mattermost-redux/constants/permissions';

import {GlobalState} from 'types/store';

import PermissionsTree from './permissions_tree';

export const EXCLUDED_PERMISSIONS = [
    Permissions.VIEW_MEMBERS,
    Permissions.JOIN_PUBLIC_TEAMS,
    Permissions.LIST_PUBLIC_TEAMS,
    Permissions.JOIN_PRIVATE_TEAMS,
    Permissions.LIST_PRIVATE_TEAMS,
    Permissions.PLAYBOOK_PUBLIC_VIEW,
    Permissions.PLAYBOOK_PRIVATE_VIEW,
];

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const license = getLicense(state);
    const customGroupsEnabled = isCustomGroupsEnabled(state);

    return {
        config,
        license,
        customGroupsEnabled,
    };
}

export default connect(mapStateToProps)(PermissionsTree);
