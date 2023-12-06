// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {getChannelStats, getChannelMembers} from 'mattermost-redux/actions/channels';
import {searchProfiles} from 'mattermost-redux/actions/users';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getMembersInCurrentChannel, getCurrentChannelStats, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getMembersInCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {searchProfilesInCurrentChannel, getProfilesInCurrentChannel} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';

import {loadStatusesForProfilesList} from 'actions/status_actions';
import {
    loadProfilesAndTeamMembersAndChannelMembers,
    loadTeamMembersAndChannelMembersForProfilesList,
} from 'actions/user_actions';
import {setModalSearchTerm} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import MemberListChannel from './member_list_channel';
import type {Props} from './member_list_channel';

const getUsersAndActionsToDisplay = createSelector(
    'getUsersAndActionsToDisplay',
    (state: GlobalState, users: UserProfile[]) => users,
    getMembersInCurrentTeam,
    getMembersInCurrentChannel,
    getCurrentChannel,
    (users = [], teamMembers = {}, channelMembers = {}, channel) => {
        const actionUserProps: {
            [userId: string]: {
                channel: Channel;
                teamMember: any;
                channelMember: ChannelMembership;
            };
        } = {};
        const usersToDisplay = [];

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            if (teamMembers[user.id] && channelMembers[user.id] && user.delete_at === 0) {
                usersToDisplay.push(user);

                actionUserProps[user.id] = {
                    channel,
                    teamMember: teamMembers[user.id],
                    channelMember: channelMembers[user.id],
                };
            }
        }

        return {
            usersToDisplay: usersToDisplay.sort(sortByUsername),
            actionUserProps,
        };
    },
);

function mapStateToProps(state: GlobalState) {
    const searchTerm = state.views.search.modalSearch;

    let users;
    if (searchTerm) {
        users = searchProfilesInCurrentChannel(state, searchTerm);
    } else {
        users = getProfilesInCurrentChannel(state);
    }

    const stats = getCurrentChannelStats(state) || {member_count: 0};

    return {
        ...getUsersAndActionsToDisplay(state, users),
        currentTeamId: state.entities.teams.currentTeamId,
        currentChannelId: state.entities.channels.currentChannelId,
        searchTerm,
        totalChannelMembers: stats.member_count,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Props['actions']>({
            getChannelMembers,
            searchProfiles,
            getChannelStats,
            setModalSearchTerm,
            loadProfilesAndTeamMembersAndChannelMembers,
            loadStatusesForProfilesList,
            loadTeamMembersAndChannelMembersForProfilesList,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MemberListChannel);
