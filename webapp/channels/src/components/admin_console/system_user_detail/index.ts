// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {addUserToTeam} from 'mattermost-redux/actions/teams';
import {updateUserActive, getUser, patchUser} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import SystemUserDetail from './system_user_detail';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        mfaEnabled: config.EnableMultifactorAuthentication === 'true',
    };
}

const mapDispatchToProps = {
    getUser,
    patchUser,
    updateUserActive,
    addUserToTeam,
    setNavigationBlocked,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps, mapDispatchToProps)(SystemUserDetail);
