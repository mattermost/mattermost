// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {editRole} from 'mattermost-redux/actions/roles';
import {updateUserRoles} from 'mattermost-redux/actions/users';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getRolesById} from 'mattermost-redux/selectors/entities/roles';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import SystemRole from './system_role';

type Props = {
    match: {
        params: {
            role_id: string;
        };
    };
}

function mapStateToProps(state: GlobalState, props: Props) {
    const role = getRolesById(state)[props.match.params.role_id];
    const license = getLicense(state);
    const isLicensedForCloud = license.Cloud === 'true';

    return {
        isLicensedForCloud,
        role,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            editRole,
            updateUserRoles,
            setNavigationBlocked,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemRole);
