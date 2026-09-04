// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import Permissions from 'mattermost-redux/constants/permissions';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import GuestPermissionsTree from './guest_permissions_tree';

export const GUEST_INCLUDED_PERMISSIONS = [
    Permissions.CREATE_PRIVATE_CHANNEL,
    Permissions.EDIT_POST,
    Permissions.DELETE_POST,
    Permissions.ADD_REACTION,
    Permissions.REMOVE_REACTION,
    Permissions.READ_CHANNEL,
    Permissions.UPLOAD_FILE,
    Permissions.EDIT_FILE_ATTACHMENT,
    Permissions.USE_CHANNEL_MENTIONS,
    Permissions.USE_GROUP_MENTIONS,
    Permissions.CREATE_POST,

    // Rendered only while the Docs feature flag is on, but listed
    // unconditionally. Membership here must not depend on the flag:
    // PermissionSystemSchemeSettings.handleSubmit splits the aggregated
    // guest permissions by scope, then re-adds every stored guest permission
    // absent from this list, so a permission that has a PermissionsScope
    // entry but is missing from this list is written to the saved role twice.
    Permissions.READ_SPACE,
];

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const config = getConfig(state);
    return {license, config};
}

export default connect(mapStateToProps)(GuestPermissionsTree);
