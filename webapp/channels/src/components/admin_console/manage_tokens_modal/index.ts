// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {getUserAccessTokensForUser} from 'mattermost-redux/actions/users';

import type {GlobalState} from 'types/store';

import ManageTokensModal from './manage_tokens_modal';

type OwnProps = {
    user?: UserProfile;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const userId = ownProps.user ? ownProps.user.id : '';

    const userAccessTokens = state.entities.admin.userAccessTokensByUser;

    return {
        userAccessTokens: userAccessTokens === undefined ? undefined : userAccessTokens[userId],
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getUserAccessTokensForUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageTokensModal);
