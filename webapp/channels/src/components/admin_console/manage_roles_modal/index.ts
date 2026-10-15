// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {updateUserRoles} from 'mattermost-redux/actions/users';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getRoles} from 'mattermost-redux/selectors/entities/roles_helpers';

import {isLicensedForDelegatedAdministration} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import ManageRolesModal from './manage_roles_modal';

function mapStateToProps(state: GlobalState) {
    return {
        userAccessTokensEnabled: state.entities.admin.config.ServiceSettings!.EnableUserAccessTokens,
        roles: getRoles(state),
        isLicensedForDelegatedAdmin: isLicensedForDelegatedAdministration(getLicense(state)),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateUserRoles,
            loadRolesIfNeeded,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageRolesModal);
