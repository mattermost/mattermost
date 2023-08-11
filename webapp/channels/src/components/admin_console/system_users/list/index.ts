// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {getUser} from 'mattermost-redux/actions/users';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';

import {getNonBotUsers} from './selectors';
import SystemUsersList from './system_users_list';

type Actions = {
    getUser: (id: string) => UserProfile;
};

type Props = {
    loading: boolean;
    teamId: string;
    term: string;
    filter: string;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const users = getNonBotUsers(state, ownProps.loading, ownProps.teamId, ownProps.term, ownProps.filter);
    return {
        users,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsersList);
