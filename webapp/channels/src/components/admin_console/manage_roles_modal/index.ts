// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import {updateUserRoles} from 'mattermost-redux/actions/users';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';

import type {GlobalState} from 'types/store';

import ManageRolesModal from './manage_roles_modal';
import type {Props} from './manage_roles_modal';

function mapStateToProps(state: GlobalState) {
    return {
        userAccessTokensEnabled: state.entities.admin.config.ServiceSettings!.EnableUserAccessTokens,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            updateUserRoles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageRolesModal);
