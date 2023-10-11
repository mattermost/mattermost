// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {ChannelStats} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile, UsersStats, GetFilteredUsersStatsOpts} from '@mattermost/types/users';

import {getChannelStats} from 'mattermost-redux/actions/channels';
import {getFilteredUsersStats} from 'mattermost-redux/actions/users';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelMembersInChannels, getAllChannelStats, getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {makeGetProfilesInChannel, makeSearchProfilesInChannel, filterProfiles, getFilteredUsersStats as selectFilteredUsersStats} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult, ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {filterProfilesStartingWithTerm, profileListToMap} from 'mattermost-redux/utils/user_utils';

import {loadProfilesAndReloadChannelMembers, searchProfilesAndChannelMembers} from 'actions/user_actions';
import {setUserGridSearch, setUserGridFilters} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import ChannelMembers from './channel_members';

type Props = {
    channelId: string;
    usersToAdd: Record<string, UserProfile>;
    usersToRemove: Record<string, UserProfile>;
};

type Actions = {
    getChannelStats: (channelId: string) => Promise<{
        data: boolean;
    }>;
    loadProfilesAndReloadChannelMembers: (page: number, perPage: number, channelId?: string, sort?: string, options?: {[key: string]: any}) => Promise<{
        data: boolean;
    }>;
    searchProfilesAndChannelMembers: (term: string, options?: {[key: string]: any}) => Promise<{
        data: boolean;
    }>;
    getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{
        data?: UsersStats;
        error?: ServerError;
    }>;
    setUserGridSearch: (term: string) => ActionResult;
    setUserGridFilters: (filters: GetFilteredUsersStatsOpts) => ActionResult;
};

function searchUsersToAdd(users: Record<string, UserProfile>, term: string): Record<string, UserProfile> {
    const profiles = filterProfilesStartingWithTerm(Object.values(users), term);
    const filteredProfilesMap = filterProfiles(profileListToMap(profiles), {});

    return filteredProfilesMap;
}

const getUserGridFilters = createSelector(
    'getUserGridFilters',
    (state: GlobalState) => state.views.search.userGridSearch.filters,
    (filters = {}) => {
        return {...filters, active: true};
    },
);

function makeMapStateToProps() {
    const doGetProfilesInChannel = makeGetProfilesInChannel();
    const doSearchProfilesInChannel = makeSearchProfilesInChannel();

    return function mapStateToProps(state: GlobalState, props: Props) {
        const {channelId, usersToRemove} = props;
        let {usersToAdd} = props;

        const config = getConfig(state);
        const channelMembers = getChannelMembersInChannels(state)[channelId] || {};
        const channel = getChannel(state, channelId) || {channel_id: channelId};
        const searchTerm = state.views.search.userGridSearch?.term || '';
        const filters = getUserGridFilters(state);

        let totalCount: number;
        if (Object.keys(filters).length === 1) {
            const stats: ChannelStats = getAllChannelStats(state)[channelId] || {
                member_count: 0,
                channel_id: channelId,
                pinnedpost_count: 0,
                guest_count: 0,
                files_count: 0,
            };
            totalCount = stats.member_count;
        } else {
            const filteredUserStats: UsersStats = selectFilteredUsersStats(state) || {
                total_users_count: 0,
            };
            totalCount = filteredUserStats.total_users_count;
        }

        let users = [];
        if (searchTerm) {
            users = doSearchProfilesInChannel(state, channelId, searchTerm, false, filters);
            usersToAdd = searchUsersToAdd(usersToAdd, searchTerm);
        } else {
            users = doGetProfilesInChannel(state, channelId, filters);
        }

        return {
            filters,
            channelId,
            channel,
            users,
            channelMembers,
            usersToAdd,
            usersToRemove,
            totalCount,
            searchTerm,
            enableGuestAccounts: config.EnableGuestAccounts === 'true',
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getChannelStats,
            loadProfilesAndReloadChannelMembers,
            searchProfilesAndChannelMembers,
            getFilteredUsersStats,
            setUserGridSearch,
            setUserGridFilters,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ChannelMembers);
