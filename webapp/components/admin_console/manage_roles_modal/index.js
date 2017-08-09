// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {updateUserRoles} from 'mattermost-redux/actions/users';

import ManageRolesModal from './manage_roles_modal.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        userAccessTokensEnabled: state.entities.admin.config.ServiceSettings.EnableUserAccessTokens
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            updateUserRoles
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageRolesModal);
