// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {addUserToTeam} from 'mattermost-redux/actions/teams';
import {updateUserActive} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import SystemUserDetail from './system_user_detail';

type OwnProps = {
    match: any;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const userId = ownProps.match.params.user_id;
    const user = getUser(state, userId);
    return {
        user,
        mfaEnabled: config.EnableMultifactorAuthentication === 'true',
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    const apiActions = bindActionCreators({
        updateUserActive,
        addUserToTeam,
    }, dispatch);
    const uiActions = bindActionCreators({
        setNavigationBlocked,
    }, dispatch);

    const props = {
        actions: Object.assign(apiActions, uiActions),
    };

    return props;
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemUserDetail);
