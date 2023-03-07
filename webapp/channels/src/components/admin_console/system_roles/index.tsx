// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getRoles} from 'mattermost-redux/selectors/entities/roles_helpers';

import {GlobalState} from 'types/store';

import SystemRoles from './system_roles';

function mapStateToProps(state: GlobalState) {
    return {
        roles: getRoles(state),
    };
}

export default connect(mapStateToProps)(SystemRoles);
