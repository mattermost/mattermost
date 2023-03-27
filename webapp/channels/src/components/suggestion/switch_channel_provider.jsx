// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import classNames from 'classnames';

import GuestTag from 'components/widgets/tag/guest_tag';
import BotTag from 'components/widgets/tag/bot_tag';

import {UserTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {
    getDirectAndGroupChannels,
    getGroupChannels,
    getMyChannelMemberships,
    getChannelByName,
    getCurrentChannel,
    getDirectTeammate,
    getChannelsInAllTeams,
    getSortedAllTeamsUnreadChannels,
    getAllTeamsUnreadChannelIds,
} from 'mattermost-redux/selectors/entities/channels';

import {getMyPreferences, isGroupChannelManuallyVisible, isCollapsedThreadsEnabled, insightsAreEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    getCurrentTeamId,
    getMyTeams,
    getTeam,
} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentUserId,
    getUserIdsInChannels,
    getUser,
    makeSearchProfilesMatchingWithTerm,
    getStatusForUserId,
    getUserByUsername,
} from 'mattermost-redux/selectors/entities/users';
import {fetchAllMyTeamsChannelsAndChannelMembersREST, searchAllChannels} from 'mattermost-redux/actions/channels';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {logError} from 'mattermost-redux/actions/errors';
import {sortChannelsByTypeAndDisplayName, isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import {getPostDraft} from 'selectors/rhs';
import store from 'stores/redux_store.jsx';
import {Constants, StoragePrefixes} from 'utils/constants';
import * as Utils from 'utils/utils';
import {isGuest} from 'mattermost-redux/utils/user_utils';
import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import Provider from './provider';
import Suggestion from './suggestion.jsx';

const getState = store.getState;
const searchProfilesMatchingWithTerm = makeSearchProfilesMatchingWithTerm();
const ThreadsChannel = {
    id: 'threads',
    name: 'threads',
    display_name: 'Threads',
    type: Constants.THREADS,
    delete_at: 0,
};

const InsightsChannel = {
    id: 'insights',
    name: 'activity-and-insights',
    display_name: 'Insights',
    type: Constants.INSIGHTS,
    delete_at: 0,
};

class SwitchChannelSuggestion extends Suggestion {
    static get propTypes() {
        return {
            ...super.propTypes,
            channelMember: PropTypes.object,
            hasDraft: PropTypes.bool,
            userImageUrl: PropTypes.string,
            dmChannelTeammate: PropTypes.object,
            collapsedThreads: PropTypes.bool,
        };
    }

    render() {
        const {item, isSelection, userImageUrl, status, userItem, collapsedThreads, team, isPartOfOnlyOneTeam} = this.props;
        const channel = item.channel;
        const channelIsArchived = channel.delete_at && channel.delete_at !== 0;

        const member = this.props.channelMember;
        const teammate = this.props.dmChannelTeammate;
        let badge = null;

        if ((member && member.notify_props) || item.unread_mentions) {
            let unreadMentions;
            if (item.unread_mentions) {
                unreadMentions = item.unread_mentions;
            } else {
                unreadMentions = collapsedThreads ? member.mention_count_root : member.mention_count;
            }
            if (unreadMentions > 0 && !channelIsArchived) {
                badge = (
                    <div className={classNames('suggestion-list_unread-mentions', (isPartOfOnlyOneTeam ? 'position-end' : ''))}>
                        <span className='badge'>
                            {unreadMentions}
                        </span>
                    </div>
                );
            }
        }

        let className = 'suggestion-list__item';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        let name = channel.display_name;
        let description = '~' + channel.name;
        let icon;
        if (channelIsArchived) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon-archive-outline'/>
                </span>
            );
        } else if (this.props.hasDraft) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon-pencil-outline'/>
                </span>
            );
        } else if (channel.type === Constants.OPEN_CHANNEL) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon-globe'/>
                </span>
            );
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon-lock-outline'/>
                </span>
            );
        } else if (channel.type === Constants.THREADS) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon-message-text-outline'/>
                </span>
            );
        } else if (channel.type === Constants.INSIGHTS) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i className='icon icon-chart-line'/>
                </span>
            );
        } else if (channel.type === Constants.GM_CHANNEL) {
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <div className='status status--group'>{'G'}</div>
                </span>
            );
        } else {
            icon = (
                <ProfilePicture
                    src={userImageUrl}
                    status={teammate && teammate.is_bot ? null : status}
                    size='sm'
                />
            );
        }

        let tag = null;
        let customStatus = null;
        if (channel.type === Constants.DM_CHANNEL) {
            if (teammate && teammate.is_bot) {
                tag = <BotTag/>;
            } else if (isGuest(teammate ? teammate.roles : '')) {
                tag = <GuestTag/>;
            }

            customStatus = (
                <CustomStatusEmoji
                    showTooltip={true}
                    userID={userItem.id}
                    emojiStyle={{
                        marginBottom: 2,
                    }}
                />
            );

            let deactivated = '';
            if (userItem.delete_at) {
                deactivated = (' - ' + Utils.localizeMessage('channel_switch_modal.deactivated', 'Deactivated'));
            }

            if (channel.display_name && !(teammate && teammate.is_bot)) {
                description = '@' + userItem.username + deactivated;
            } else {
                name = userItem.username;
                const currentUserId = getCurrentUserId(getState());
                if (userItem.id === currentUserId) {
                    name += (' ' + Utils.localizeMessage('suggestion.user.isCurrent', '(you)'));
                }
                description = deactivated;
            }
        } else if (channel.type === Constants.GM_CHANNEL) {
            // remove the slug from the option
            name = channel.display_name;
            description = '';
        }

        let sharedIcon = null;
        if (channel.shared) {
            sharedIcon = (
                <SharedChannelIndicator
                    className='shared-channel-icon'
                    channelType={channel.type}
                />
            );
        }

        let teamName = null;
        if (channel.team_id && team) {
            teamName = (<span className='ml-2 suggestion-list__team-name'>{team.display_name}</span>);
        }
        const showSlug = (isPartOfOnlyOneTeam || channel.type === Constants.DM_CHANNEL) && channel.type !== Constants.THREADS;

        return (
            <div
                onClick={this.handleClick}
                onMouseMove={this.handleMouseMove}
                className={className}
                role='listitem'
                ref={(node) => {
                    this.node = node;
                }}
                id={`switchChannel_${channel.name}`}
                data-testid={channel.name}
                aria-label={name}
                {...Suggestion.baseProps}
            >
                {icon}
                <div className='suggestion-list__ellipsis suggestion-list__flex'>
                    <span className='suggestion-list__main'>
                        <span className={classNames({'suggestion-list__unread': item.unread && !channelIsArchived})}>{name}</span>
                        {showSlug && description && <span className='ml-2 suggestion-list__desc'>{description}</span>}
                    </span>
                    {customStatus}
                    {sharedIcon}
                    {tag}
                    {badge}
                    {!isPartOfOnlyOneTeam && teamName}
                </div>
            </div>
        );
    }
}

function mapStateToPropsForSwitchChannelSuggestion(state, ownProps) {
    const channel = ownProps.item && ownProps.item.channel;
    const channelId = channel ? channel.id : '';
    const draft = channelId ? getPostDraft(state, StoragePrefixes.DRAFT, channelId) : false;
    const user = channel && getUser(state, channel.userId);
    const userImageUrl = user && Utils.imageURLForUser(user.id, user.last_picture_update);
    let dmChannelTeammate = channel && channel.type === Constants.DM_CHANNEL && getDirectTeammate(state, channel.id);
    const userItem = getUserByUsername(state, channel.name);
    const status = getStatusForUserId(state, channel.userId);
    const collapsedThreads = isCollapsedThreadsEnabled(state);
    const team = getTeam(state, channel.team_id);
    const isPartOfOnlyOneTeam = getMyTeams(state).length === 1;

    if (channel && !dmChannelTeammate) {
        dmChannelTeammate = getUser(state, channel.userId);
    }

    return {
        channelMember: getMyChannelMemberships(state)[channelId],
        hasDraft: draft && Boolean(draft.message.trim() || draft.fileInfos.length || draft.uploadsInProgress.length),
        userImageUrl,
        dmChannelTeammate,
        status,
        userItem,
        collapsedThreads,
        team,
        isPartOfOnlyOneTeam,
    };
}

const ConnectedSwitchChannelSuggestion = connect(mapStateToPropsForSwitchChannelSuggestion, null, null, {forwardRef: true})(SwitchChannelSuggestion);

let prefix = '';

function sortChannelsByRecencyAndTypeAndDisplayName(wrappedA, wrappedB) {
    if (wrappedA.last_viewed_at && wrappedB.last_viewed_at) {
        return wrappedB.last_viewed_at - wrappedA.last_viewed_at;
    } else if (wrappedA.last_viewed_at) {
        return -1;
    } else if (wrappedB.last_viewed_at) {
        return 1;
    }

    // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
    return sortChannelsByTypeAndDisplayName('en', wrappedA.channel, wrappedB.channel);
}

export function quickSwitchSorter(wrappedA, wrappedB) {
    const aIsArchived = wrappedA.channel.delete_at ? wrappedA.channel.delete_at !== 0 : false;
    const bIsArchived = wrappedB.channel.delete_at ? wrappedB.channel.delete_at !== 0 : false;

    if (aIsArchived && !bIsArchived) {
        return 1;
    } else if (!aIsArchived && bIsArchived) {
        return -1;
    }

    if (wrappedA.deactivated && !wrappedB.deactivated) {
        return 1;
    } else if (wrappedB.deactivated && !wrappedA.deactivated) {
        return -1;
    }

    const a = wrappedA.channel;
    const b = wrappedB.channel;

    let aDisplayName = a.display_name.toLowerCase();
    let bDisplayName = b.display_name.toLowerCase();

    if (a.type === Constants.DM_CHANNEL && aDisplayName.startsWith('@')) {
        aDisplayName = aDisplayName.substring(1);
    }

    if (b.type === Constants.DM_CHANNEL && bDisplayName.startsWith('@')) {
        bDisplayName = bDisplayName.substring(1);
    }

    const aStartsWith = aDisplayName.startsWith(prefix) || wrappedA.name.toLowerCase().startsWith(prefix);
    const bStartsWith = bDisplayName.startsWith(prefix) || wrappedB.name.toLowerCase().startsWith(prefix);

    // Open channels user haven't interacted should be at the  bottom of the list
    if (a.type === Constants.OPEN_CHANNEL && !wrappedA.last_viewed_at && (b.type !== Constants.OPEN_CHANNEL || wrappedB.last_viewed_at)) {
        return 1;
    } else if (b.type === Constants.OPEN_CHANNEL && !wrappedB.last_viewed_at) {
        return -1;
    }

    // Sort channels starting with the search term first
    if (aStartsWith && !bStartsWith) {
        return -1;
    } else if (!aStartsWith && bStartsWith) {
        return 1;
    }
    return sortChannelsByRecencyAndTypeAndDisplayName(wrappedA, wrappedB);
}

function makeChannelSearchFilter(channelPrefix) {
    const channelPrefixLower = channelPrefix.toLowerCase();
    const splitPrefixBySpace = channelPrefixLower.trim().split(/[ ,]+/);
    const curState = getState();
    const usersInChannels = getUserIdsInChannels(curState);
    const userSearchStrings = {};

    return (channel) => {
        let searchString = `${channel.display_name}${channel.name}`;
        if (channel.type === Constants.GM_CHANNEL || channel.type === Constants.DM_CHANNEL) {
            const usersInChannel = usersInChannels[channel.id] || new Set([]);

            // In case the channel is a DM and the profilesInChannel is not populated
            if (!usersInChannel.size && channel.type === Constants.DM_CHANNEL) {
                const userId = Utils.getUserIdFromChannelId(channel.name);
                const user = getUser(curState, userId);
                if (user) {
                    usersInChannel.add(userId);
                }
            }

            for (const userId of usersInChannel) {
                let userString = userSearchStrings[userId];

                if (!userString) {
                    const user = getUser(curState, userId);
                    if (!user) {
                        continue;
                    }
                    const {nickname, username} = user;
                    userString = `${nickname}${username}${Utils.getFullName(user)}`;
                    userSearchStrings[userId] = userString;
                }
                searchString += userString;
            }
        }

        if (splitPrefixBySpace.length > 1) {
            const lowerCaseSearch = searchString.toLowerCase();
            return splitPrefixBySpace.every((searchPrefix) => {
                return lowerCaseSearch.includes(searchPrefix);
            });
        }

        return searchString.toLowerCase().includes(channelPrefixLower);
    };
}

export default class SwitchChannelProvider extends Provider {
    /**
     * whenever this gets adjusted/refactored to not call the callback twice we need to adjust the behavior in
     * the ForwardPostChannelSelect component as well.
     *
     * @see {@link components/forward_post_modal/forward_post_channel_select.tsx}
     */
    handlePretextChanged(channelPrefix, resultsCallback) {
        if (channelPrefix) {
            prefix = channelPrefix;
            this.startNewRequest(channelPrefix);
            if (this.shouldCancelDispatch(channelPrefix)) {
                return false;
            }

            // Dispatch suggestions for local data (filter out deleted and archived channels from local store data)
            const channels = getChannelsInAllTeams(getState()).concat(getDirectAndGroupChannels(getState())).filter((c) => c.delete_at === 0);
            const users = Object.assign([], searchProfilesMatchingWithTerm(getState(), channelPrefix, false));
            const formattedData = this.formatList(channelPrefix, [ThreadsChannel, InsightsChannel, ...channels], users, true, true);
            if (formattedData) {
                resultsCallback(formattedData);
            }

            // Fetch data from the server and dispatch
            this.fetchUsersAndChannels(channelPrefix, resultsCallback);
        } else {
            this.fetchAndFormatRecentlyViewedChannels(resultsCallback);
        }

        return true;
    }

    async fetchUsersAndChannels(channelPrefix, resultsCallback) {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        if (!teamId) {
            return;
        }

        const config = getConfig(state);
        let usersAsync;
        if (config.RestrictDirectMessage === 'team') {
            usersAsync = Client4.autocompleteUsers(channelPrefix, teamId, '');
        } else {
            usersAsync = Client4.autocompleteUsers(channelPrefix, '', '');
        }

        const channelsAsync = searchAllChannels(channelPrefix, {nonAdminSearch: true})(store.dispatch, store.getState);

        let usersFromServer = [];
        let channelsFromServer = [];

        try {
            usersFromServer = await usersAsync;
            const {data} = await channelsAsync;
            channelsFromServer = data;
        } catch (err) {
            store.dispatch(logError(err));
        }

        if (this.shouldCancelDispatch(channelPrefix)) {
            return;
        }

        const currentUserId = getCurrentUserId(state);

        // filter out deleted and archived channels from local store data
        const localChannelData = getChannelsInAllTeams(state).concat(getDirectAndGroupChannels(state)).filter((c) => c.delete_at === 0) || [];
        const localUserData = Object.assign([], searchProfilesMatchingWithTerm(state, channelPrefix, false)) || [];
        const localFormattedData = this.formatList(channelPrefix, [ThreadsChannel, InsightsChannel, ...localChannelData], localUserData);
        const remoteChannelData = channelsFromServer.concat(getGroupChannels(state)) || [];
        const remoteUserData = Object.assign([], usersFromServer.users) || [];
        const remoteFormattedData = this.formatList(channelPrefix, remoteChannelData, remoteUserData, false);

        store.dispatch({
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: [...localUserData.filter((user) => user.id !== currentUserId), ...remoteUserData.filter((user) => user.id !== currentUserId)],
        });
        const combinedTerms = [...localFormattedData.terms, ...remoteFormattedData.terms.filter((term) => !localFormattedData.terms.includes(term))];
        const combinedItems = [...localFormattedData.items, ...remoteFormattedData.items.filter((item) => !localFormattedData.terms.includes(item.channel.userId || item.channel.id))];

        resultsCallback({
            ...localFormattedData,
            ...{
                items: combinedItems,
                terms: combinedTerms,
            },
        });
    }

    userWrappedChannel(user, channel) {
        let displayName = '';
        const currentUserId = getCurrentUserId(getState());

        // The naming format is fullname (nickname)
        // username is shown seperately
        if ((user.first_name || user.last_name) && user.nickname) {
            displayName += Utils.getFullName(user);
            if (user.id !== currentUserId) {
                displayName += ` (${user.nickname})`;
            }
        } else if (user.nickname && !user.first_name && !user.last_name) {
            displayName += `${user.nickname}`;
        } else if (user.first_name || user.last_name) {
            displayName += `${Utils.getFullName(user)}`;
        }

        if (user.id === currentUserId && displayName) {
            displayName += (' ' + Utils.localizeMessage('suggestion.user.isCurrent', '(you)'));
        }

        return {
            channel: {
                display_name: displayName,
                name: user.username,
                id: channel ? channel.id : user.id,
                userId: user.id,
                update_at: user.update_at,
                type: Constants.DM_CHANNEL,
                last_picture_update: user.last_picture_update || 0,
            },
            type: 'search.direct',
            name: user.username,
            deactivated: user.delete_at,
        };
    }

    formatList(channelPrefix, allChannels, users, skipNotMember = true, localData = false) {
        const channels = [];

        const members = getMyChannelMemberships(getState());

        const completedChannels = {};

        const channelFilter = makeChannelSearchFilter(channelPrefix);

        const state = getState();
        const config = getConfig(state);
        const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';
        const allUnreadChannelIds = getAllTeamsUnreadChannelIds(state);
        const allUnreadChannelIdsSet = new Set(allUnreadChannelIds);
        const currentUserId = getCurrentUserId(state);

        for (const id of Object.keys(allChannels)) {
            const channel = allChannels[id];

            if (completedChannels[channel.id]) {
                continue;
            }
            if (channelFilter(channel)) {
                const newChannel = Object.assign({}, channel);
                const channelIsArchived = channel.delete_at !== 0;

                let wrappedChannel = {channel: newChannel, name: newChannel.name, deactivated: false};
                if (members[channel.id]) {
                    wrappedChannel.last_viewed_at = members[channel.id].last_viewed_at;
                } else if (skipNotMember && (newChannel.type !== Constants.THREADS && newChannel.type !== Constants.INSIGHTS)) {
                    continue;
                }

                if (!viewArchivedChannels && channelIsArchived) {
                    continue;
                } else if (channelIsArchived && members[channel.id]) {
                    wrappedChannel.type = Constants.ARCHIVED_CHANNEL;
                } else if (newChannel.type === Constants.OPEN_CHANNEL) {
                    wrappedChannel.type = Constants.MENTION_PUBLIC_CHANNELS;
                } else if (newChannel.type === Constants.PRIVATE_CHANNEL) {
                    wrappedChannel.type = Constants.MENTION_PRIVATE_CHANNELS;
                } else if (channelIsArchived && !members[channel.id]) {
                    continue;
                } else if (newChannel.type === Constants.THREADS) {
                    const threadItem = this.getThreadsItem('total');
                    if (threadItem) {
                        wrappedChannel = threadItem;
                    } else {
                        continue;
                    }
                } else if (newChannel.type === Constants.INSIGHTS) {
                    const insightsItem = this.getInsightsItem();
                    if (insightsItem) {
                        wrappedChannel = insightsItem;
                    } else {
                        continue;
                    }
                } else if (newChannel.type === Constants.GM_CHANNEL) {
                    newChannel.name = newChannel.display_name;
                    wrappedChannel.name = newChannel.name;
                    wrappedChannel.type = Constants.MENTION_GROUPS;
                    const isGMVisible = isGroupChannelManuallyVisible(state, channel.id);
                    if (!isGMVisible && skipNotMember) {
                        continue;
                    }
                } else if (newChannel.type === Constants.DM_CHANNEL) {
                    const userId = Utils.getUserIdFromChannelId(newChannel.name);
                    const user = users.find((u) => u.id === userId);

                    if (user) {
                        completedChannels[user.id] = true;
                        wrappedChannel = this.userWrappedChannel(
                            user,
                            newChannel,
                        );
                        if (members[channel.id]) {
                            wrappedChannel.last_viewed_at = members[channel.id].last_viewed_at;
                        }
                    } else {
                        continue;
                    }
                }

                const unread = allUnreadChannelIdsSet.has(newChannel.id) && !isChannelMuted(members[channel.id]);
                if (unread) {
                    wrappedChannel.unread = true;
                }
                completedChannels[channel.id] = true;
                channels.push(wrappedChannel);
            }
        }

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            if (completedChannels[user.id]) {
                continue;
            }

            const channelName = Utils.getDirectChannelName(currentUserId, user.id);
            const channel = getChannelByName(state, channelName);

            const wrappedChannel = this.userWrappedChannel(user, channel);

            if (channel && members[channel.id]) {
                wrappedChannel.last_viewed_at = members[channel.id].last_viewed_at;
            } else if (skipNotMember) {
                continue;
            }

            const unread = allUnreadChannelIdsSet.has(channel?.id) && !isChannelMuted(members[channel.id]);
            if (unread) {
                wrappedChannel.unread = true;
            }

            completedChannels[user.id] = true;
            channels.push(wrappedChannel);
        }

        const channelNames = channels.
            sort(quickSwitchSorter).
            map((wrappedChannel) => wrappedChannel.channel.userId || wrappedChannel.channel.id);

        if (localData && !channels.length) {
            channels.push({
                type: Constants.MENTION_MORE_CHANNELS,
                loading: true,
            });
        }

        return {
            matchedPretext: channelPrefix,
            terms: channelNames,
            items: channels,
            component: ConnectedSwitchChannelSuggestion,
        };
    }

    fetchAndFormatRecentlyViewedChannels(resultsCallback) {
        const state = getState();
        const recentChannels = getChannelsInAllTeams(state).concat(getDirectAndGroupChannels(state));
        const wrappedRecentChannels = this.wrapChannels(recentChannels, Constants.MENTION_RECENT_CHANNELS);
        const unreadChannels = getSortedAllTeamsUnreadChannels(state);
        const myMembers = getMyChannelMemberships(state);
        const unreadChannelsExclMuted = unreadChannels.filter((channel) => {
            const member = myMembers[channel.id];
            return !isChannelMuted(member);
        }).slice(0, 5);
        let sortedUnreadChannels = this.wrapChannels(unreadChannelsExclMuted, Constants.MENTION_UNREAD);
        if (wrappedRecentChannels.length === 0) {
            prefix = '';
            this.startNewRequest('');
            this.fetchChannels(resultsCallback);
        }
        const sortedUnreadChannelIDs = sortedUnreadChannels.map((wrappedChannel) => wrappedChannel.channel.id);
        const sortedRecentChannels = wrappedRecentChannels.filter((wrappedChannel) => !sortedUnreadChannelIDs.includes(wrappedChannel.channel.id)).
            sort(sortChannelsByRecencyAndTypeAndDisplayName).slice(0, 20);
        const threadsItem = this.getThreadsItem('unread', Constants.MENTION_UNREAD);
        if (threadsItem) {
            sortedUnreadChannels = [threadsItem, ...sortedUnreadChannels].slice(0, 5);
        }
        const sortedChannels = [...sortedUnreadChannels, ...sortedRecentChannels];
        const channelNames = sortedChannels.map((wrappedChannel) => wrappedChannel.channel.id);
        resultsCallback({
            matchedPretext: '',
            terms: channelNames,
            items: sortedChannels,
            component: ConnectedSwitchChannelSuggestion,
        });
    }

    getThreadsItem(countType = 'total', itemType) {
        const state = getState();
        const counts = getThreadCountsInCurrentTeam(state);
        const collapsedThreads = isCollapsedThreadsEnabled(state);

        // adding last viewed at equal to Date.now() to push it to the top of the list
        let threadsItem = {
            channel: ThreadsChannel,
            name: ThreadsChannel.name,
            unread_mentions: counts?.total_unread_mentions || 0,
            deactivated: false,
            last_viewed_at: Date.now(),
        };
        if (itemType) {
            threadsItem = {...threadsItem, type: itemType};
        }
        if (counts?.total_unread_threads) {
            threadsItem.unread = true;
        }
        if (collapsedThreads && ((countType === 'unread' && counts?.total_unread_threads) || (countType === 'total'))) {
            return threadsItem;
        }

        return null;
    }

    getInsightsItem() {
        const state = getState();
        const insightsEnabled = insightsAreEnabled(state);

        // adding last viewed at equal to Date.now() to push it to the top of the list
        const insightsItem = {
            channel: InsightsChannel,
            name: InsightsChannel.name,
            unread_mentions: 0,
            deactivated: false,
            last_viewed_at: Date.now(),
        };

        if (insightsEnabled) {
            return insightsItem;
        }

        return null;
    }

    getTimestampFromPrefs(myPreferences, category, name) {
        const pref = myPreferences[getPreferenceKey(category, name)];
        const prefValue = pref ? pref.value : '0';
        return parseInt(prefValue, 10);
    }

    getLastViewedAt(member, myPreferences, channel) {
        // The server only ever sets the last_viewed_at to the time of the last post in channel,
        // So thought of using preferences but it seems that also not keeping track.
        // TODO Update and remove comment once solution is finalized
        return Math.max(
            member.last_viewed_at,
            this.getTimestampFromPrefs(myPreferences, Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME, channel.id),
            this.getTimestampFromPrefs(myPreferences, Preferences.CATEGORY_CHANNEL_OPEN_TIME, channel.id),
        );
    }

    wrapChannels(channels, channelType) {
        const state = getState();
        const currentChannel = getCurrentChannel(state);
        const myMembers = getMyChannelMemberships(state);
        const myPreferences = getMyPreferences(state);
        const collapsedThreads = isCollapsedThreadsEnabled(state);
        const allUnreadChannelIds = getAllTeamsUnreadChannelIds(state);
        const allUnreadChannelIdsSet = new Set(allUnreadChannelIds);

        const channelList = [];
        for (let i = 0; i < channels.length; i++) {
            const channel = channels[i];
            if (channel.id === currentChannel?.id) {
                continue;
            }
            let wrappedChannel = {channel, name: channel.name, deactivated: false};
            const member = myMembers[channel.id];
            if (member) {
                wrappedChannel.last_viewed_at = this.getLastViewedAt(member, myPreferences, channel);
            }
            if (member && channelType === Constants.MENTION_UNREAD) {
                wrappedChannel.unreadMentions = collapsedThreads ? member.mention_count_root : member.mention_count;
            }
            if (channel.type === Constants.GM_CHANNEL) {
                wrappedChannel.name = channel.display_name;
            } else if (channel.type === Constants.DM_CHANNEL) {
                const user = getUser(getState(), Utils.getUserIdFromChannelId(channel.name));

                if (!user) {
                    continue;
                }
                const userWrappedChannel = this.userWrappedChannel(
                    user,
                    channel,
                );
                wrappedChannel = {...wrappedChannel, ...userWrappedChannel};
            }
            const unread = allUnreadChannelIdsSet.has(channel.id) && !isChannelMuted(member);
            if (unread) {
                wrappedChannel.unread = true;
            }

            wrappedChannel.type = channelType;
            channelList.push(wrappedChannel);
        }
        return channelList;
    }

    async fetchChannels(resultsCallback) {
        const state = getState();
        const teamId = getCurrentTeamId(state);
        if (!teamId) {
            return;
        }
        const channelsAsync = fetchAllMyTeamsChannelsAndChannelMembersREST()(store.dispatch, store.getState);
        let channels;

        try {
            const {data} = await channelsAsync;
            channels = data.channels;
        } catch (err) {
            store.dispatch(logError(err));
        }

        if (this.latestPrefix !== '') {
            return;
        }
        const sortedChannels = this.wrapChannels(channels, Constants.MENTION_PUBLIC_CHANNELS).slice(0, 20);
        const channelNames = sortedChannels.map((wrappedChannel) => wrappedChannel.channel.id);

        resultsCallback({
            matchedPretext: '',
            terms: channelNames,
            items: sortedChannels,
            component: ConnectedSwitchChannelSuggestion,
        });
    }
}
