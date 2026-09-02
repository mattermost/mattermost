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
    rotateUserAccessToken,
} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import UserAccessTokenSection from './user_access_token_section';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const maxLifetimeDays = parseInt(config.MaximumPersonalAccessTokenLifetimeDays || '0', 10);
    return {
        userAccessTokens: state.entities.users.myUserAccessTokens,
        maxLifetimeDays: Number.isFinite(maxLifetimeDays) ? maxLifetimeDays : 0,
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
            rotateUserAccessToken,
            clearUserAccessTokens,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserAccessTokenSection);
