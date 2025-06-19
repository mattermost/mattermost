// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {searchGroupChannels} from 'mattermost-redux/actions/channels';
import {fetchRemoteClusterInfo} from 'mattermost-redux/actions/shared_channels';
import {
    getProfiles,
    getProfilesInTeam,
    getTotalUsersStats,
    searchProfiles,
} from 'mattermost-redux/actions/users';
import {getConfig, getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentUserId,
    getProfiles as selectProfiles,
    getProfilesInCurrentChannel,
    getProfilesInCurrentTeam,
    makeSearchProfilesStartingWithTerm,
    searchProfilesInCurrentTeam,
    getTotalUsersStats as getTotalUsersStatsSelector,
    userCanSeeOtherUser,
} from 'mattermost-redux/selectors/entities/users';

import {openDirectChannelToUserId, openGroupChannelToUserIds} from 'actions/channel_actions';
import {loadStatusesForProfilesList, loadProfilesMissingStatus} from 'actions/status_actions';
import {loadProfilesForGroupChannels} from 'actions/user_actions';
import {setModalSearchTerm} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import MoreDirectChannels from './more_direct_channels';

type OwnProps = {
    isExistingChannel: boolean;
}

export const makeMapStateToProps = () => {
    const searchProfilesStartingWithTerm = makeSearchProfilesStartingWithTerm();

    return (state: GlobalState, ownProps: OwnProps) => {
        const currentUserId = getCurrentUserId(state);
        let currentChannelMembers;
        if (ownProps.isExistingChannel) {
            currentChannelMembers = getProfilesInCurrentChannel(state);
        }

        const config = getConfig(state);
        const restrictDirectMessage = config.RestrictDirectMessage;

        const searchTerm = state.views.search.modalSearch;

        let filters;
        const enableSharedChannelsDMs = getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true';
        if (!enableSharedChannelsDMs) {
            filters = {exclude_remote: true};
        }

        let users: UserProfile[];
        if (searchTerm) {
            if (restrictDirectMessage === 'any') {
                users = searchProfilesStartingWithTerm(state, searchTerm, false, filters);
            } else {
                users = searchProfilesInCurrentTeam(state, searchTerm, false, filters);
            }
        } else if (restrictDirectMessage === 'any') {
            users = selectProfiles(state, filters);
        } else {
            users = getProfilesInCurrentTeam(state, filters);
        }

        // Filter out users that can't be messaged directly because they're from indirectly connected remote clusters
        if (enableSharedChannelsDMs) {
            const originalUserCount = users.length;
            const remoteUsers = users.filter((user) => user.remote_id);
            // eslint-disable-next-line no-console
            console.log(`[DEBUG] MoreDirectChannels: Before filtering - ${originalUserCount} users, ${remoteUsers.length} remote users`, {
                remoteUserDetails: remoteUsers.map((u) => ({id: u.id, username: u.username, remote_id: u.remote_id})),
            });
            users = users.filter((user) => {
                const canSee = userCanSeeOtherUser(state, user.id);
                if (!canSee && user.remote_id) {
                    // eslint-disable-next-line no-console
                    console.log(`[DEBUG] MoreDirectChannels: Filtered out remote user ${user.username} (${user.id}) from remote ${user.remote_id}`);
                }
                return canSee;
            });

            // eslint-disable-next-line no-console
            console.log(`[DEBUG] MoreDirectChannels: After filtering - ${users.length} users remaining (filtered out ${originalUserCount - users.length})`);
        }

        const team = getCurrentTeam(state);
        const stats = getTotalUsersStatsSelector(state) || {total_users_count: 0};

        return {
            currentTeamId: team?.id,
            currentTeamName: team?.name,
            searchTerm,
            users,
            currentChannelMembers,
            currentUserId,
            restrictDirectMessage,
            totalCount: stats.total_users_count ?? 0,
        };
    };
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getProfiles,
            getProfilesInTeam,
            loadProfilesMissingStatus,
            getTotalUsersStats,
            loadStatusesForProfilesList,
            loadProfilesForGroupChannels,
            openDirectChannelToUserId,
            openGroupChannelToUserIds,
            searchProfiles,
            searchGroupChannels,
            setModalSearchTerm,
            fetchRemoteClusterInfo,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(MoreDirectChannels);
