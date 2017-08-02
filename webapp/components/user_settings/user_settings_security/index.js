// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getMe, getUserAccessTokensForUser, createUserAccessToken, revokeUserAccessToken, clearUserAccessTokens} from 'mattermost-redux/actions/users';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import SecurityTab from './user_settings_security.jsx';

function mapStateToProps(state, ownProps) {
    const tokensEnabled = state.entities.general.config.EnableUserAccessTokens === 'true';
    const userHasTokenRole = UserUtils.hasUserAccessTokenRole(ownProps.user.roles) || UserUtils.isSystemAdmin(ownProps.user.roles);

    return {
        ...ownProps,
        userAccessTokens: state.entities.users.myUserAccessTokens,
        canUseAccessTokens: tokensEnabled && userHasTokenRole
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getMe,
            getUserAccessTokensForUser,
            createUserAccessToken,
            revokeUserAccessToken,
            clearUserAccessTokens
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SecurityTab);
