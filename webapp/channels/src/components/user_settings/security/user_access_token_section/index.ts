// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {
    clearUserAccessTokens,
    createUserAccessToken,
    getUserAccessTokensForUser,
    revokeUserAccessToken,
    enableUserAccessToken,
    disableUserAccessToken,
} from 'mattermost-redux/actions/users';

import UserAccessTokenSection from './user_access_token_section';

function mapStateToProps(state: GlobalState) {
    return {
        userAccessTokens: state.entities.users.myUserAccessTokens,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getUserAccessTokensForUser,
            createUserAccessToken,
            revokeUserAccessToken,
            enableUserAccessToken,
            disableUserAccessToken,
            clearUserAccessTokens,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserAccessTokenSection);
