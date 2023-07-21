// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import Permissions from 'mattermost-redux/constants/permissions';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {GlobalState} from 'types/store';

import GuestPermissionsTree from './guest_permissions_tree';

export const GUEST_INCLUDED_PERMISSIONS = [
    Permissions.CREATE_PRIVATE_CHANNEL,
    Permissions.EDIT_POST,
    Permissions.DELETE_POST,
    Permissions.ADD_REACTION,
    Permissions.REMOVE_REACTION,
    Permissions.USE_CHANNEL_MENTIONS,
    Permissions.USE_GROUP_MENTIONS,
    Permissions.CREATE_POST,
];

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    return {license};
}

export default connect(mapStateToProps)(GuestPermissionsTree);
