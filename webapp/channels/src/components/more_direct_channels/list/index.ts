// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAllChannels, getChannelsWithUserProfiles} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';
import {filterProfilesStartingWithTerm} from 'mattermost-redux/utils/user_utils';

import Constants from 'utils/constants';

import List from './list';

import type {Option, OptionValue} from '../types';
import type {UserProfile} from '@mattermost/types/users';
import type {GlobalState} from 'types/store';

type OwnProps = {
    users: UserProfile[];
    values: OptionValue[];
}

export function makeGetOptions(): (state: GlobalState, users: UserProfile[], values: OptionValue[]) => Option[] {
    // Gets all loaded DMs (as UserProfiles)
    const getUsersWithDMs = createSelector(
        'getUsersWithDMs',
        getCurrentUserId,
        getAllChannels,
        (state: GlobalState, users: UserProfile[]) => users,
        (currentUserId, allChannels, users) => {
            const directChannels = Object.values(allChannels).filter((channel) => channel.type === Constants.DM_CHANNEL);

            // Gets all loaded DMs (as UserProfiles)
            const usersWithDMs: Array<UserProfile & {last_post_at: number}> = [];
            for (const channel of directChannels) {
                const otherUserId = getUserIdFromChannelName(currentUserId, channel.name);
                const otherUser = users.find((user) => user.id === otherUserId);

                if (!otherUser) {
                    // The user doesn't match the search filter
                    continue;
                }

                if (channel.last_post_at === 0) {
                    // The DM channel exists but has no messages in it
                    continue;
                }

                usersWithDMs.push({
                    ...otherUser,
                    last_post_at: channel.last_post_at,
                });
            }

            return usersWithDMs;
        },
    );

    // Gets GM channels matching the search term and selected values
    const getFilteredGroupChannels = createSelector(
        'getFilteredGroupChannels',
        getChannelsWithUserProfiles,
        (state: GlobalState) => state.views.search.modalSearch,
        (state: GlobalState, values: OptionValue[]) => values,
        (channelsWithProfiles, searchTerm, values) => {
            return channelsWithProfiles.filter((channel) => {
                if (searchTerm) {
                    // Check that at least one of the users in the channel matches the search term
                    const matches = filterProfilesStartingWithTerm(channel.profiles, searchTerm);
                    if (matches.length === 0) {
                        return false;
                    }
                }

                if (values) {
                    // Check that all of the selected users are in the channel
                    const valuesInProfiles = values.every((value) => channel.profiles.find((user) => user.id === value.id));
                    if (!valuesInProfiles) {
                        return false;
                    }
                }

                // Only include GM channels with messages in them
                return channel.last_post_at > 0;
            });
        },
    );

    return createSelector(
        'makeGetOptions',
        getUsersWithDMs,
        (state: GlobalState, users: UserProfile[], values: OptionValue[]) => getFilteredGroupChannels(state, values),
        (state: GlobalState, users: UserProfile[]) => users,
        (state: GlobalState) => Boolean(state.views.search.modalSearch),
        (usersWithDMs, filteredGroupChannels, users, isSearch) => {
            // Recent DMs (as UserProfiles) and GMs sorted by recent activity
            const recents = [...usersWithDMs, ...filteredGroupChannels].
                sort((a, b) => b.last_post_at - a.last_post_at);

            // Only show the 20 most recent DMs and GMs when no search term has been entered. If a search term has been
            // entered, `users` is expected to have already been filtered by it
            if (!isSearch && recents.length > 0) {
                return recents.slice(0, 20);
            }

            // Other users sorted by whether or not they've been deactivated followed by alphabetically
            const usersWithoutDMs = users.
                filter((user) => user.delete_at === 0 && !usersWithDMs.some((other) => other.id === user.id)).
                map((user) => ({...user, last_post_at: 0}));
            usersWithoutDMs.sort((a, b) => {
                return a.username.localeCompare(b.username);
            });

            // Returns an array containing:
            //  1. All recent DMs (represented by UserProfiles) and GMs matching the filter
            //      - GMs are also filtered to only show ones containing each selected user
            //  2. Other non-deactivated users sorted by username
            return [
                ...recents,
                ...usersWithoutDMs,
            ];
        },
    );
}

function makeMapStateToProps() {
    const getOptions = makeGetOptions();

    return (state: GlobalState, ownProps: OwnProps) => {
        return {
            options: getOptions(state, ownProps.users, ownProps.values),
        };
    };
}

export default connect(makeMapStateToProps)(List);
