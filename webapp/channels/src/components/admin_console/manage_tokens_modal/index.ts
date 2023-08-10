// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getUserAccessTokensForUser} from 'mattermost-redux/actions/users';

import ManageTokensModal from './manage_tokens_modal';

import type {Props} from './manage_tokens_modal';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const userId = ownProps.user ? ownProps.user.id : '';

    const userAccessTokens = state.entities.admin.userAccessTokensByUser;

    return {
        userAccessTokens: userAccessTokens === undefined ? undefined : userAccessTokens[userId],
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            getUserAccessTokensForUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageTokensModal);
