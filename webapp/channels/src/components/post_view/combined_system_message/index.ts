// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getMissingProfilesByIds, getMissingProfilesByUsernames} from 'mattermost-redux/actions/users';
import {Preferences} from 'mattermost-redux/constants';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, makeGetProfilesByIdsAndUsernames} from 'mattermost-redux/selectors/entities/users';
import type {GenericAction} from 'mattermost-redux/types/actions';

import CombinedSystemMessage from './combined_system_message';

type OwnProps = {
    allUserIds: string[];
    allUsernames: string[];
}

function makeMapStateToProps() {
    const getProfilesByIdsAndUsernames = makeGetProfilesByIdsAndUsernames();

    return (state: GlobalState, ownProps: OwnProps) => {
        const currentUser = getCurrentUser(state);
        const {allUserIds, allUsernames} = ownProps;

        return {
            currentUserId: currentUser.id,
            currentUsername: currentUser.username,
            showJoinLeave: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE, true),
            userProfiles: getProfilesByIdsAndUsernames(state, {allUserIds, allUsernames}),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            getMissingProfilesByIds,
            getMissingProfilesByUsernames,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(CombinedSystemMessage);
